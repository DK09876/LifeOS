/**
 * What the voice assistant can do, run on the Pi.
 *
 * Each intent uses the app's own actions (lib/actions.ts) against the
 * database, so "I did laundry" by voice does precisely what ticking it in
 * the app does - completion log, recurrence, goal progress and all. Every
 * intent answers with one short sentence meant to be spoken, plus data for
 * anything that wants it.
 *
 * Intents that change something record what they changed, so "undo that"
 * can put it back.
 */

import { addDays } from 'date-fns';

import { createActions } from '@/lib/actions';
import type { Habit, Note, Project } from '@/types';
import { getTodayString, parseLocalDate, toDateString } from '@/lib/dates';
import { isHabitDueOn } from '@/lib/recurrence';
import { isMissedPlan, isOverdue } from '@/lib/scoring';
import { isOnToday, tasksForDay } from '@/lib/schedule';
import { apOf, CAPACITY_PREF, dayLoad, parseCapacityMap, pruneCapacityMap } from '@/lib/capacity';
import { currentStreak } from '@/lib/streaks';
import { HISTORY_PREF, parseHistory } from '@/lib/history';
import { buildReview, periodFor } from '@/lib/review';
import { findByName, listing, Match, resolveDay, sayDay } from '@/lib/assistant-text';
import { serverDb, serverPreferences, type ChangeLog } from './db';
import { popUndo, pushUndo, putRecord, setPreference, type Collection, type StoredRecord } from './store';

export interface AssistantResult {
  ok: boolean;
  /** One or two short sentences, written to be spoken. */
  say: string;
  data?: unknown;
}

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN);

function context(userId: string, log?: ChangeLog) {
  const db = serverDb(userId, log);
  const prefs = serverPreferences(userId, log);
  const actions = createActions({ db, ...prefs });
  return { db, prefs, actions };
}

const live = <T extends { deletedAt?: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

/** Turn a match into either the item or a spoken question/apology. */
function pick<T>(match: Match<T>, nameOf: (t: T) => string, what: string, query: string): T | AssistantResult {
  if (match.kind === 'one') return match.item;
  if (match.kind === 'ambiguous') {
    return { ok: false, say: `Did you mean ${listing(match.items.map(nameOf).map((n) => `"${n}"`), 3).replace(/ and /, ' or ')}?` };
  }
  return { ok: false, say: `I couldn't find a ${what} called "${query}".` };
}
const isResult = (x: unknown): x is AssistantResult => !!x && typeof x === 'object' && 'say' in (x as object) && 'ok' in (x as object);

async function snapshot(userId: string) {
  const { db, prefs } = context(userId);
  const [tasks, habits, events, projects, notes] = await Promise.all([
    db.tasks.toArray(), db.habits.toArray(), db.events.toArray(), db.projects.toArray(), db.notes.toArray(),
  ]);
  return {
    tasks: live(tasks), habits: live(habits), events: live(events), projects: live(projects), notes: live(notes),
    prefs, db,
  };
}

function budgetFor(userId: string, date: string) {
  const { actions } = context(userId);
  return actions.readEnergySettings().budgetFor(date);
}

function defaultAP(userId: string) {
  return context(userId).actions.readEnergySettings().controls.defaultAP;
}

/** What a day holds: its tasks, the habits due, its events, and the AP picture. */
function dayPicture(userId: string, s: Awaited<ReturnType<typeof snapshot>>, date: string) {
  const today = getTodayString();
  const tasks = date === today ? s.tasks.filter((t) => isOnToday(t, date)) : tasksForDay(s.tasks, date).map((x) => x.task);
  const habitsDue = s.habits.filter((h) => h.isActive && isHabitDueOn(h, date));
  const habitsDone = s.habits.filter((h) => (h.completionDates || []).includes(date));
  const events = s.events.filter((e) => e.date === date);
  const load = dayLoad(s.tasks, s.events, defaultAP(userId), date, { due: habitsDue, done: habitsDone });
  return { tasks, habitsDue, events, load, budget: budgetFor(userId, date) };
}

// --- intents ---------------------------------------------------------------

type Intent = (userId: string, args: Args, log: ChangeLog) => Promise<AssistantResult>;

const intents: Record<string, Intent> = {
  /** Everything on today, and the energy picture. */
  async today(userId) {
    const s = await snapshot(userId);
    const today = getTodayString();
    const d = dayPicture(userId, s, today);
    const parts: string[] = [];
    parts.push(d.tasks.length ? `${d.tasks.length} ${d.tasks.length === 1 ? 'task' : 'tasks'}: ${listing(d.tasks.map((t) => t.taskName))}` : 'No tasks planned');
    if (d.habitsDue.length) parts.push(`habits left: ${listing(d.habitsDue.map((h) => h.habitName))}`);
    if (d.events.length) parts.push(`events: ${listing(d.events.map((e) => (e.time ? `${e.eventName} at ${e.time}` : e.eventName)))}`);
    const say = `${parts.join('. ')}. ${d.load.committed} of ${d.budget} AP planned, ${d.load.done} done.`;
    return { ok: true, say, data: { tasks: d.tasks.map((t) => t.taskName), habits: d.habitsDue.map((h) => h.habitName), load: d.load, budget: d.budget } };
  },

  /** The single best thing to do next, within today's remaining energy. */
  async next(userId) {
    const s = await snapshot(userId);
    const today = getTodayString();
    const d = dayPicture(userId, s, today);
    const left = d.budget - d.load.done;
    const ap = defaultAP(userId);
    const candidates = [...d.tasks].sort((a, b) => b.taskScore - a.taskScore);
    const fits = candidates.find((t) => apOf(t, ap) <= Math.max(left, 1));
    if (fits) return { ok: true, say: `${fits.taskName}. It's ${apOf(fits, ap)} AP and you have about ${Math.max(0, left)} left.` };
    if (d.habitsDue.length) return { ok: true, say: `Nothing's planned that fits, but ${d.habitsDue[0].habitName} is still to do.` };
    const backlog = s.tasks.filter((t) => (t.status === 'Backlog' || t.status === 'Planned') && !t.plannedDate).sort((a, b) => b.taskScore - a.taskScore);
    if (backlog[0]) return { ok: true, say: `Today's clear. The top thing in your backlog is ${backlog[0].taskName}.` };
    return { ok: true, say: 'Nothing on your list right now.' };
  },

  /**
   * A new task. Whatever was said is used; whatever was not stays unset, so
   * the task waits in Needs Details unless everything was given.
   */
  async add_task(userId, args) {
    const name = str(args.name);
    if (!name) return { ok: false, say: 'What should the task be called?' };
    const today = getTodayString();
    const { db } = context(userId);
    const plannedDate = resolveDay(str(args.day), today);
    const dueDate = resolveDay(str(args.due), today);
    const domains = live(await db.domains.toArray());
    const domainName = str(args.domain);
    const domain = domainName ? findByName(domains, domainName, (d) => d.name) : null;
    const levels = { essential: '1 - Urgent', urgent: '1 - Urgent', high: '2 - High', normal: '3 - Normal', low: '4 - Low', optional: '5 - Optional' } as const;
    const urgencies = { critical: '1 - Critical', urgent: '1 - Critical', high: '2 - High', normal: '3 - Normal', low: '4 - Low', someday: '5 - Someday' } as const;
    const priority = str(args.priority)?.toLowerCase() as keyof typeof levels | undefined;
    const urgency = str(args.urgency)?.toLowerCase() as keyof typeof urgencies | undefined;
    const effort = num(args.effort);
    return withLog(userId, `add ${name}`, async (log) => {
      await context(userId, log).actions.createTask({
        taskName: name,
        plannedDate,
        dueDate,
        domainId: domain?.kind === 'one' ? domain.item.id : null,
        taskPriority: priority && levels[priority] ? levels[priority] : null,
        urgency: urgency && urgencies[urgency] ? urgencies[urgency] : null,
        actionPoints: effort >= 0 && effort <= 5 ? String(Math.round(effort)) : null,
      });
      const when = plannedDate ? ` for ${sayDay(plannedDate, today)}` : dueDate ? `, due ${sayDay(dueDate, today)}` : '';
      return { ok: true, say: `Added ${name}${when}.` };
    });
  },

  /** Plan a task for a day (reopening a finished do-again chore if needed). */
  async plan(userId, args) {
    const query = str(args.name);
    const today = getTodayString();
    const day = resolveDay(str(args.day) ?? 'today', today);
    if (!query) return { ok: false, say: 'Which task?' };
    if (!day) return { ok: false, say: `I didn't understand the day "${String(args.day)}".` };
    const s = await snapshot(userId);
    const open = s.tasks.filter((t) => t.status !== 'Archived' && t.status !== 'Done');
    let found = pick(findByName(open, query, (t) => t.taskName), (t) => t.taskName, 'task', query);
    if (isResult(found)) {
      const done = s.tasks.filter((t) => t.status === 'Done' && t.recurrence === 'None');
      const again = findByName(done, query, (t) => t.taskName);
      if (again.kind !== 'one') return found;
      found = again.item;
    }
    const task = found;
    return withLog(userId, `plan ${task.taskName}`, async (log) => {
      const { actions } = context(userId, log);
      if (task.status === 'Done') await actions.reopenTask(task.id, false);
      await actions.updateTaskData(task.id, { plannedDate: day });
      return { ok: true, say: `${task.taskName} is on ${sayDay(day, today)}.` };
    });
  },

  /** "I won't get to it today" - move it to tomorrow. */
  async push(userId, args) {
    return intents.plan(userId, { ...args, day: 'tomorrow' }, { records: [], preferences: [] });
  },

  /** Reopen a finished do-again chore, for today unless told otherwise. */
  async do_again(userId, args) {
    const query = str(args.name);
    if (!query) return { ok: false, say: 'Which one?' };
    const s = await snapshot(userId);
    const done = s.tasks.filter((t) => t.status === 'Done' && t.recurrence === 'None')
      .sort((a, b) => Number(!!b.repeatable) - Number(!!a.repeatable));
    const found = pick(findByName(done, query, (t) => t.taskName), (t) => t.taskName, 'finished task', query);
    if (isResult(found)) return found;
    const toToday = args.today !== false;
    return withLog(userId, `do ${found.taskName} again`, async (log) => {
      await context(userId, log).actions.reopenTask(found.id, toToday);
      return { ok: true, say: toToday ? `${found.taskName} is back on today.` : `${found.taskName} is back on your list.` };
    });
  },

  /** Mark a task done - today, or on the day given ("yesterday"). */
  async complete(userId, args) {
    const query = str(args.name);
    if (!query) return { ok: false, say: 'Which task?' };
    const today = getTodayString();
    const day = resolveDay(str(args.day) ?? 'today', today) ?? today;
    if (day > today) return { ok: false, say: "I can't mark something done in the future." };
    const s = await snapshot(userId);
    const open = s.tasks.filter((t) => t.status !== 'Archived' && t.status !== 'Done');
    const found = pick(findByName(open, query, (t) => t.taskName), (t) => t.taskName, 'task', query);
    if (isResult(found)) {
      // Maybe it is a habit.
      const habit = findByName(s.habits.filter((h) => h.isActive), query, (h) => h.habitName);
      if (habit.kind === 'one') return intents.habit_done(userId, { name: habit.item.habitName, day: args.day }, { records: [], preferences: [] });
      return found;
    }
    return withLog(userId, `complete ${found.taskName}`, async (log) => {
      await context(userId, log).actions.markTaskDone(found.id, day);
      return { ok: true, say: `Marked ${found.taskName} done${day === today ? '' : ` for ${sayDay(day, today)}`}.` };
    });
  },

  /** Tick a habit - today or yesterday. */
  async habit_done(userId, args) {
    const query = str(args.name);
    if (!query) return { ok: false, say: 'Which habit?' };
    const today = getTodayString();
    const day = resolveDay(str(args.day) ?? 'today', today) ?? today;
    const s = await snapshot(userId);
    const found = pick(findByName(s.habits.filter((h) => h.isActive), query, (h) => h.habitName), (h: Habit) => h.habitName, 'habit', query);
    if (isResult(found)) return found;
    if ((found.completionDates || []).includes(day)) return { ok: true, say: `${found.habitName} is already ticked for ${sayDay(day, today)}.` };
    return withLog(userId, `tick ${found.habitName}`, async (log) => {
      const reached = await context(userId, log).actions.markHabitDone(found.id, day);
      const streak = currentStreak([...(found.completionDates || []), day], found.targetPerWeek, today);
      const milestone = reached.length ? ` That's a ${reached[reached.length - 1].label}!` : '';
      return { ok: true, say: `Ticked ${found.habitName}. ${streak.current} ${streak.unit}${streak.current === 1 ? '' : 's'} running.${milestone}` };
    });
  },

  /** Log progress on a goal: "read 12 pages". */
  async log_progress(userId, args) {
    const amount = num(args.amount);
    if (!Number.isFinite(amount) || amount === 0) return { ok: false, say: 'How much should I log?' };
    const today = getTodayString();
    const day = resolveDay(str(args.day) ?? 'today', today) ?? today;
    const s = await snapshot(userId);
    const goals = s.projects.filter((p) => p.kind === 'target' && p.status === 'Active');
    const query = str(args.goal) ?? str(args.unit);
    let goal: Project | AssistantResult;
    if (query) {
      const byName = findByName(goals, query, (p) => p.name);
      goal = byName.kind === 'none'
        ? pick(findByName(goals, query, (p) => p.targetUnit || ''), (p) => p.name, 'goal', query)
        : pick(byName, (p) => p.name, 'goal', query);
    } else if (goals.length === 1) {
      goal = goals[0];
    } else {
      goal = { ok: false, say: goals.length ? `Which goal: ${listing(goals.map((g) => g.name)).replace(/ and /, ' or ')}?` : "You don't have a goal to log against." };
    }
    if (isResult(goal)) return goal;
    const g = goal;
    return withLog(userId, `log ${amount} to ${g.name}`, async (log) => {
      await context(userId, log).actions.logProjectProgress(g.id, amount, undefined, day);
      const total = (g.progressLog ?? []).reduce((n, e) => n + e.amount, 0) + amount;
      const of = g.targetCount ? ` of ${g.targetCount}` : '';
      return { ok: true, say: `Logged ${amount} ${g.targetUnit || ''} to ${g.name}. ${total}${of} so far.`.replace(/\s+/g, ' ') };
    });
  },

  /** Today's energy: used, planned, budget. */
  async energy(userId) {
    const s = await snapshot(userId);
    const today = getTodayString();
    const d = dayPicture(userId, s, today);
    const left = d.budget - d.load.committed;
    const verdict = left < 0 ? `You're ${-left} over.` : left === 0 ? "That's your whole budget." : `${left} AP free.`;
    return { ok: true, say: `${d.load.done} AP done, ${d.load.planned} still planned, out of ${d.budget}. ${verdict}` };
  },

  /** Change just today's budget. */
  async set_energy(userId, args) {
    const ap = Math.round(num(args.ap));
    if (!Number.isFinite(ap) || ap < 0 || ap > 30) return { ok: false, say: 'What should today’s budget be?' };
    const today = getTodayString();
    return withLog(userId, `set today to ${ap}`, async (log) => {
      const { prefs } = context(userId, log);
      const map = pruneCapacityMap({ ...parseCapacityMap(prefs.getPreference(CAPACITY_PREF)), [today]: ap }, today);
      await prefs.savePreference(CAPACITY_PREF, JSON.stringify(map));
      return { ok: true, say: `Today's budget is ${ap} AP.` };
    });
  },

  /** Overdue deadlines and missed plans. */
  async overdue(userId) {
    const s = await snapshot(userId);
    const today = getTodayString();
    const overdue = s.tasks.filter((t) => isOverdue(t, today) && t.status !== 'Blocked');
    const missed = s.tasks.filter((t) => isMissedPlan(t, today) && !overdue.includes(t));
    if (!overdue.length && !missed.length) return { ok: true, say: 'Nothing overdue and no missed plans.' };
    const parts = [];
    if (overdue.length) parts.push(`Overdue: ${listing(overdue.map((t) => t.taskName))}`);
    if (missed.length) parts.push(`Missed plans: ${listing(missed.map((t) => t.taskName))}`);
    return { ok: true, say: `${parts.join('. ')}.` };
  },

  /** What a given day holds. */
  async day(userId, args) {
    const today = getTodayString();
    const date = resolveDay(str(args.day) ?? 'today', today);
    if (!date) return { ok: false, say: `I didn't understand the day "${String(args.day)}".` };
    const s = await snapshot(userId);
    const d = dayPicture(userId, s, date);
    const when = sayDay(date, today);
    const items = [...d.events.map((e) => (e.time ? `${e.eventName} at ${e.time}` : e.eventName)), ...d.tasks.map((t) => t.taskName)];
    if (!items.length) return { ok: true, say: `Nothing on ${when} yet. ${d.budget} AP free.` };
    return { ok: true, say: `${when[0].toUpperCase()}${when.slice(1)}: ${listing(items)}. ${d.load.committed} of ${d.budget} AP.` };
  },

  /** The rest of this week, day by day. */
  async week(userId) {
    const s = await snapshot(userId);
    const today = getTodayString();
    const lines: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = toDateString(addDays(parseLocalDate(today), i));
      const d = dayPicture(userId, s, date);
      const n = d.tasks.length + d.events.length;
      if (n) lines.push(`${sayDay(date, today)} ${n}`);
      if (parseLocalDate(date).getDay() === 0) break;
    }
    return { ok: true, say: lines.length ? `Things planned — ${lines.join(', ')}.` : 'Nothing planned for the rest of the week.' };
  },

  /** Mark something blocked, waiting on someone, with a day to chase. */
  async block(userId, args) {
    const query = str(args.name);
    const waitingOn = str(args.waiting_on);
    const today = getTodayString();
    const chase = resolveDay(str(args.chase) ?? 'in 3 days', today);
    if (!query) return { ok: false, say: 'Which task is waiting?' };
    if (!chase) return { ok: false, say: 'When should I remind you to chase it?' };
    const s = await snapshot(userId);
    const open = s.tasks.filter((t) => t.status !== 'Archived' && t.status !== 'Done');
    const found = pick(findByName(open, query, (t) => t.taskName), (t) => t.taskName, 'task', query);
    if (isResult(found)) return found;
    return withLog(userId, `block ${found.taskName}`, async (log) => {
      await context(userId, log).actions.updateTaskData(found.id, {
        status: 'Blocked',
        blockedBy: [...(found.blockedBy || []), ...(waitingOn ? [{ type: 'note' as const, note: waitingOn }] : [])],
        followUpDate: chase,
      });
      return { ok: true, say: `${found.taskName} is waiting${waitingOn ? ` on ${waitingOn}` : ''}. I'll remind you ${sayDay(chase, today)}.` };
    });
  },

  /** Everything blocked, and when to chase it. */
  async waiting(userId) {
    const s = await snapshot(userId);
    const today = getTodayString();
    const blocked = s.tasks.filter((t) => t.status === 'Blocked');
    if (!blocked.length) return { ok: true, say: "You're not waiting on anything." };
    const items = blocked.map((t) => {
      const on = (t.blockedBy || []).map((b) => (b.type === 'note' ? b.note : s.tasks.find((x) => x.id === b.taskId)?.taskName)).filter(Boolean).join(' and ');
      const chase = t.followUpDate ? `, chase ${sayDay(t.followUpDate, today)}` : '';
      return `${t.taskName}${on ? ` on ${on}` : ''}${chase}`;
    });
    return { ok: true, say: `Waiting: ${listing(items)}.` };
  },

  /** How this week has gone. */
  async review(userId) {
    const s = await snapshot(userId);
    const { actions, prefs } = context(userId);
    const energy = actions.readEnergySettings();
    const domains = live(await context(userId).db.domains.toArray());
    const r = buildReview({
      period: periodFor('week', 0), tasks: s.tasks, habits: s.habits, events: s.events, projects: s.projects, domains,
      history: parseHistory(prefs.getPreference(HISTORY_PREF)), defaultAP: energy.controls.defaultAP, budgetFor: energy.budgetFor,
    });
    const net = r.backlog.end - r.backlog.start;
    const backlog = net < 0 ? `your backlog shrank by ${-net}` : net > 0 ? `your backlog grew by ${net}` : 'your backlog held steady';
    const habits = r.habits.length ? `, habits ${r.habits.reduce((n, h) => n + h.done, 0)} of ${r.habits.reduce((n, h) => n + h.expected, 0)}` : '';
    return { ok: true, say: `This week: ${r.totals.finished} things done, ${r.totals.spent} of ${r.totals.capacity} AP, ${backlog}${habits}.` };
  },

  /** A habit's streak. */
  async streak(userId, args) {
    const query = str(args.name);
    if (!query) return { ok: false, say: 'Which habit?' };
    const s = await snapshot(userId);
    const found = pick(findByName(s.habits, query, (h) => h.habitName), (h: Habit) => h.habitName, 'habit', query);
    if (isResult(found)) return found;
    const st = currentStreak(found.completionDates || [], found.targetPerWeek);
    const best = Math.max(found.bestStreak ?? 0, st.current);
    return { ok: true, say: `${found.habitName}: ${st.current} ${st.unit}${st.current === 1 ? '' : 's'} running, best ${best}.` };
  },

  /** The morning brief, on request. */
  async brief(userId) {
    const today = await intents.today(userId, {}, { records: [], preferences: [] });
    const overdue = await intents.overdue(userId, {}, { records: [], preferences: [] });
    return { ok: true, say: overdue.say.startsWith('Nothing') ? today.say : `${today.say} ${overdue.say}` };
  },

  /** Find a note or list by what it says. */
  async find_note(userId, args) {
    const query = str(args.query);
    if (!query) return { ok: false, say: 'What should I look for?' };
    const s = await snapshot(userId);
    const text = (n: Note) => `${n.title} ${n.body} ${n.items.map((i) => i.text).join(' ')}`;
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const scored = s.notes.map((n) => ({ n, hits: words.filter((w) => text(n).toLowerCase().includes(w)).length }))
      .filter((x) => x.hits > 0).sort((a, b) => b.hits - a.hits);
    if (!scored.length) return { ok: false, say: `I couldn't find a note about ${query}.` };
    const n = scored[0].n;
    if (n.kind === 'list') return { ok: true, say: `${n.title}: ${listing(n.items.filter((i) => !i.done).map((i) => i.text)) || 'nothing unticked'}.` };
    return { ok: true, say: n.body ? `${n.title}: ${n.body}` : n.title };
  },

  /** Add items to a list (Shopping by default), creating it if needed. */
  async list_add(userId, args) {
    const items = (Array.isArray(args.items) ? args.items : String(args.items ?? '').split(','))
      .map((i) => String(i).trim()).filter(Boolean);
    if (!items.length) return { ok: false, say: 'What should I add?' };
    const listName = str(args.list) ?? 'Shopping';
    const s = await snapshot(userId);
    const lists = s.notes.filter((n) => n.kind === 'list');
    const match = findByName(lists, listName, (n) => n.title);
    return withLog(userId, `add to ${listName}`, async (log) => {
      const { actions } = context(userId, log);
      const additions = items.map((text) => ({ id: crypto.randomUUID(), text, done: false }));
      if (match.kind === 'one') {
        await actions.updateNote(match.item.id, { items: [...match.item.items, ...additions] });
      } else {
        const title = listName.replace(/\b\w/g, (c) => c.toUpperCase());
        await actions.createNote({ title, kind: 'list', items: additions });
      }
      return { ok: true, say: `Added ${listing(items)} to ${match.kind === 'one' ? match.item.title : listName}.` };
    });
  },

  /** What is still unticked on a list. */
  async list_read(userId, args) {
    const s = await snapshot(userId);
    const listName = str(args.list) ?? 'Shopping';
    const found = pick(findByName(s.notes.filter((n) => n.kind === 'list'), listName, (n) => n.title), (n: Note) => n.title, 'list', listName);
    if (isResult(found)) return found;
    const left = found.items.filter((i) => !i.done).map((i) => i.text);
    return { ok: true, say: left.length ? `${found.title}: ${listing(left, 12)}.` : `${found.title} is empty.` };
  },

  /** Tick an item off a list: "got the eggs". */
  async list_tick(userId, args) {
    const item = str(args.item);
    if (!item) return { ok: false, say: 'Which item?' };
    const s = await snapshot(userId);
    const lists = s.notes.filter((n) => n.kind === 'list');
    const scope = str(args.list) ? lists.filter((l) => findByName([l], str(args.list)!, (n) => n.title).kind === 'one') : lists;
    const entries = scope.flatMap((l) => l.items.filter((i) => !i.done).map((i) => ({ list: l, entry: i })));
    const found = pick(findByName(entries, item, (e) => e.entry.text), (e) => e.entry.text, 'list item', item);
    if (isResult(found)) return found;
    return withLog(userId, `tick ${found.entry.text}`, async (log) => {
      await context(userId, log).actions.updateNote(found.list.id, {
        items: found.list.items.map((i) => (i.id === found.entry.id ? { ...i, done: true } : i)),
      });
      return { ok: true, say: `Ticked ${found.entry.text} off ${found.list.title}.` };
    });
  },

  /** Save something to remember. */
  async add_note(userId, args) {
    const body = str(args.text);
    if (!body) return { ok: false, say: 'What should I remember?' };
    const title = str(args.title) ?? (body.length > 40 ? `${body.slice(0, 40).replace(/\s+\S*$/, '')}…` : body);
    return withLog(userId, 'add a note', async (log) => {
      await context(userId, log).actions.createNote({ title, kind: 'note', body });
      return { ok: true, say: 'Noted.' };
    });
  },

  /** Put back whatever the last voice change did. */
  async undo(userId) {
    const last = popUndo(userId);
    if (!last) return { ok: false, say: "There's nothing of mine to undo." };
    const log = JSON.parse(last.data) as ChangeLog;
    const now = new Date().toISOString();
    for (const r of [...log.records].reverse()) {
      if (r.before) {
        putRecord(userId, r.collection as Collection, { ...r.before, updatedAt: now } as StoredRecord);
      } else {
        // It did not exist before: remove it the app's way, with a tombstone.
        const { db } = context(userId);
        const table = db[r.collection as keyof typeof db] as unknown as { update(id: string, c: object): Promise<number> };
        await table.update(r.id, { deletedAt: now, updatedAt: now });
      }
    }
    for (const p of log.preferences) setPreference(userId, p.key, p.before ?? '');
    return { ok: true, say: `Undone: ${last.label}.` };
  },
};

/** Run a change, and keep its before-images for undo if anything changed. */
async function withLog(userId: string, label: string, run: (log: ChangeLog) => Promise<AssistantResult>): Promise<AssistantResult> {
  const log: ChangeLog = { records: [], preferences: [] };
  const result = await run(log);
  if (result.ok && (log.records.length || log.preferences.length)) pushUndo(userId, label, JSON.stringify(log));
  return result;
}

export const ASSISTANT_INTENTS = Object.keys(intents);

export async function runAssistant(userId: string, intent: string, args: Args = {}): Promise<AssistantResult> {
  const handler = intents[intent];
  if (!handler) return { ok: false, say: `I don't know how to ${intent}.` };
  try {
    return await handler(userId, args, { records: [], preferences: [] });
  } catch (error) {
    console.error('[assistant]', intent, error);
    return { ok: false, say: 'Something went wrong on the LifeOS side.' };
  }
}
