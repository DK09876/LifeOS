'use client';

/**
 * Looking back.
 *
 * Every other page is about what to do next. This one is the only place the
 * app says anything about you rather than about your list: whether the budget
 * you set matches the days you actually have, and whether the habits you keep
 * saying you will keep are being kept.
 */

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

import HabitHistory from '@/components/HabitHistory';
import { useDomains, useEnergySettings, useEvents, useHabits, useProjects, useTasks } from '@/lib/hooks';
import { buildReview, daysBetween, periodFor, PeriodKind, Review } from '@/lib/review';
import { milestoneLabel } from '@/lib/milestones';
import { getTodayString } from '@/lib/dates';
import { useLiveQuery } from '@/lib/live-query';
import { getPreference } from '@/lib/store';
import { calibrate, HISTORY_PREF, parseHistory, recentDays } from '@/lib/history';
import { DEFAULT_SUGGEST_CONTROLS, SuggestControls } from '@/lib/suggest';
import { parseLocalDate } from '@/lib/dates';

const WINDOW = 28;

type Tab = PeriodKind | 'trends';

export default function ReviewPage() {
  const [tab, setTab] = useState<Tab>('week');
  const [offset, setOffset] = useState(0);
  // Deep link from the weekly/monthly notification: /retrospect?period=week
  useEffect(() => {
    const period = new URLSearchParams(window.location.search).get('period');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (period === 'week' || period === 'month' || period === 'trends') setTab(period);
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white mb-1">Review</h1>
        <p className="text-[var(--muted)]">How the time went, and what it says</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {([['week', 'Week'], ['month', 'Month'], ['trends', 'Last 4 weeks']] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setOffset(0); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === key ? 'bg-blue-600 text-white' : 'bg-[var(--card-bg)] text-[var(--muted)] hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'trends' ? <TrendsView /> : <PeriodView kind={tab} offset={offset} setOffset={setOffset} />}
    </div>
  );
}

function PeriodView({ kind, offset, setOffset }: { kind: PeriodKind; offset: number; setOffset: (n: number) => void }) {
  const tasks = useTasks();
  const habits = useHabits();
  const events = useEvents();
  const projects = useProjects();
  const domains = useDomains();
  const energy = useEnergySettings();
  const storedHistory = useLiveQuery(() => getPreference(HISTORY_PREF), []);
  const history = useMemo(() => parseHistory(storedHistory), [storedHistory]);
  const today = getTodayString();

  const review = useMemo(() => {
    const args = { tasks, habits, events, projects, domains, history, defaultAP: energy.controls.defaultAP, budgetFor: energy.budgetFor, today };
    return {
      now: buildReview({ ...args, period: periodFor(kind, offset, today) }),
      prev: buildReview({ ...args, period: periodFor(kind, offset - 1, today) }),
    };
  }, [tasks, habits, events, projects, domains, history, energy, kind, offset, today]);

  return <PeriodReview r={review.now} prev={review.prev} offset={offset} setOffset={setOffset} />;
}

function Delta({ now, prev, invert = false }: { now: number; prev: number; invert?: boolean }) {
  const d = now - prev;
  if (!d) return <span className="text-xs text-[var(--muted)]">same as before</span>;
  const good = invert ? d < 0 : d > 0;
  return <span className={`text-xs ${good ? 'text-green-400' : 'text-amber-400'}`}>{d > 0 ? '▲' : '▼'} {Math.abs(d)} vs previous</span>;
}

function PeriodReview({ r, prev, offset, setOffset }: { r: Review; prev: Review; offset: number; setOffset: (n: number) => void }) {
  const peak = Math.max(1, ...r.days.map(d => Math.max(d.spent, d.capacity)));
  const backlogPeak = Math.max(1, ...r.backlog.series.map(p => p.open), r.backlog.start);
  const domainPeak = Math.max(1, ...r.byDomain.map(d => d.ap));
  const net = r.backlog.end - r.backlog.start;
  const finishedByDay = new Map<string, typeof r.finished>();
  for (const f of r.finished) finishedByDay.set(f.day, [...(finishedByDay.get(f.day) ?? []), f]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setOffset(offset - 1)} className="p-2 rounded hover:bg-[var(--card-bg)] text-[var(--muted)] hover:text-white" aria-label="Previous">←</button>
        <span className="text-white font-medium">{r.period.label}</span>
        <button onClick={() => setOffset(offset + 1)} disabled={offset >= 0} className="p-2 rounded hover:bg-[var(--card-bg)] text-[var(--muted)] hover:text-white disabled:opacity-30" aria-label="Next">→</button>
        {offset !== 0 && <button onClick={() => setOffset(0)} className="text-xs text-blue-400 ml-2">Back to now</button>}
      </div>

      {/* Headline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Tile label="Things finished" value={String(r.totals.finished)} extra={<Delta now={r.totals.finished} prev={prev.totals.finished} />} />
        <Tile label="Energy spent" value={`${r.totals.spent} / ${r.totals.capacity} AP`} extra={<Delta now={r.totals.spent} prev={prev.totals.spent} />} />
        <Tile label="Backlog" value={`${r.backlog.start} → ${r.backlog.end}`}
              extra={<span className={`text-xs ${net < 0 ? 'text-green-400' : net > 0 ? 'text-amber-400' : 'text-[var(--muted)]'}`}>
                {net < 0 ? `shrank by ${-net}` : net > 0 ? `grew by ${net}` : 'held steady'} · +{r.backlog.created} new, −{r.backlog.closed} done
              </span>} />
        <Tile label="Days over budget" value={`${r.totals.overDays} of ${r.days.length}`} extra={<Delta now={r.totals.overDays} prev={prev.totals.overDays} invert />} />
      </div>

      {/* Energy by day */}
      <Section title="Energy by day" note="Bars are what each day cost; the dashed line is what it was allowed. Amber means over.">
        {r.days.length === 0 ? <Empty>Nothing has happened in this period yet.</Empty> : (
          <>
            <div className="flex items-end gap-1 h-28 mb-1">
              {r.days.map(d => (
                <div key={d.date} className="flex-1 relative h-full flex flex-col justify-end"
                     title={`${format(parseLocalDate(d.date), 'EEE d MMM')} — ${d.spent} of ${d.capacity} AP, ${d.finished} done`}>
                  <div className="absolute left-0 right-0 border-t border-dashed border-[var(--muted)]/50" style={{ bottom: `${(d.capacity / peak) * 100}%` }} />
                  <div className={`rounded-t ${d.spent > d.capacity ? 'bg-amber-500' : 'bg-green-500/80'}`} style={{ height: `${(d.spent / peak) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="flex gap-1 text-[10px] text-[var(--muted)]">
              {r.days.map(d => <span key={d.date} className="flex-1 text-center truncate">{r.days.length <= 7 ? format(parseLocalDate(d.date), 'EEE') : format(parseLocalDate(d.date), 'd')}</span>)}
            </div>
          </>
        )}
      </Section>

      {/* Backlog trend */}
      <Section title="Backlog" note="Open one-off tasks at the end of each day. Recurring work is left out; it never shrinks.">
        {r.backlog.series.length === 0 ? <Empty>No days yet.</Empty> : (
          <div className="flex items-end gap-1 h-20">
            {r.backlog.series.map(p => (
              <div key={p.date} className="flex-1 h-full flex flex-col justify-end" title={`${format(parseLocalDate(p.date), 'EEE d MMM')} — ${p.open} open`}>
                <div className="rounded-t bg-blue-500/70" style={{ height: `${(p.open / backlogPeak) * 100}%` }} />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Domains */}
      <Section title="Where the effort went" note="Finished tasks by life area, in AP.">
        {r.byDomain.length === 0 ? <Empty>No tasks finished in this period.</Empty> : (
          <div className="space-y-2">
            {r.byDomain.map(d => (
              <div key={d.id ?? 'none'} className="flex items-center gap-3 text-sm">
                <span className="w-32 truncate text-white">{d.icon ? `${d.icon} ` : ''}{d.name}</span>
                <div className="flex-1 h-2 bg-[var(--background)] rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(d.ap / domainPeak) * 100}%` }} />
                </div>
                <span className="w-20 text-right text-xs text-[var(--muted)]">{d.ap} AP · {d.count}</span>
              </div>
            ))}
          </div>
        )}
        {r.quietDomains.length > 0 && (
          <p className="text-xs text-[var(--muted)] mt-3">
            Nothing finished in: {r.quietDomains.map(d => `${d.icon ?? ''} ${d.name}`.trim()).join(', ')}
          </p>
        )}
      </Section>

      {/* What slipped */}
      <Section title="What slipped" note="Plans missed in this period, overdue deadlines, and anything moved more than once.">
        {r.stillMissed.length + r.overdue.length + r.slipped.length === 0 ? <Empty>Nothing slipped. 👌</Empty> : (
          <div className="space-y-3 text-sm">
            {r.overdue.length > 0 && (
              <List label="Overdue" tone="text-red-300" items={r.overdue.map(t => `${t.taskName} — ${daysBetween(t.dueDate!, getTodayString())}d late`)} />
            )}
            {r.stillMissed.length > 0 && (
              <List label="Planned and not done" tone="text-orange-300" items={r.stillMissed.map(t => `${t.taskName} (${format(parseLocalDate(t.plannedDate!), 'EEE d MMM')})`)} />
            )}
            {r.slipped.length > 0 && (
              <List label="Moved more than once" tone="text-amber-300" items={r.slipped.map(t => `${t.taskName} — ${t.slipCount}×`)} />
            )}
          </div>
        )}
      </Section>

      {/* Habits */}
      <Section title="Habits" note="Times done against roughly how often each was asked for.">
        {r.habits.length === 0 ? <Empty>No active habits.</Empty> : (
          <div className="space-y-2">
            {r.habits.map(({ habit, done, expected }) => {
              const pct = expected ? Math.min(100, Math.round((done / expected) * 100)) : 0;
              return (
                <div key={habit.id} className="flex items-center gap-3 text-sm">
                  <span className="w-40 truncate text-white">{habit.icon || '🔄'} {habit.habitName}</span>
                  <div className="flex-1 h-2 bg-[var(--background)] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-16 text-right text-xs text-[var(--muted)]">{done} / {expected}</span>
                </div>
              );
            })}
          </div>
        )}
        {r.milestones.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {r.milestones.map(m => (
              <span key={`${m.habit.id}-${m.key}`} className="text-xs px-2 py-1 rounded bg-amber-500/15 text-amber-300">
                🏆 {m.habit.habitName}: {milestoneLabel(m.key)}
              </span>
            ))}
          </div>
        )}
      </Section>

      {r.projects.length > 0 && (
        <Section title="Projects and goals" note="What moved in this period.">
          <div className="space-y-1 text-sm">
            {r.projects.map(({ project, logged, apDone }) => (
              <div key={project.id} className="flex justify-between">
                <span className="text-white">{project.icon || '📦'} {project.name}</span>
                <span className="text-xs text-[var(--muted)]">
                  {project.kind === 'target' ? `+${logged} ${project.targetUnit || 'done'}` : `${apDone} AP of tasks done`}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Finished, day by day */}
      <Section title="Finished" note={`${r.finished.length} tasks${r.events.attended ? ` · ${r.events.attended} events attended` : ''}.`}>
        {r.finished.length === 0 ? <Empty>No tasks finished.</Empty> : (
          <div className="space-y-3">
            {Array.from(finishedByDay.entries()).map(([day, items]) => (
              <div key={day}>
                <p className="text-xs text-[var(--muted)] mb-1">{format(parseLocalDate(day), 'EEEE d MMM')}</p>
                <ul className="text-sm text-white space-y-0.5">
                  {items.map(({ task }) => <li key={`${task.id}-${day}`}>✓ {task.taskName}{task.recurrence !== 'None' && <span className="text-xs text-cyan-400"> ↻</span>}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-[var(--card-bg)] rounded-lg p-5 mb-6">
      <h2 className="text-lg font-medium text-white mb-1">{title}</h2>
      {note && <p className="text-sm text-[var(--muted)] mb-4">{note}</p>}
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--muted)]">{children}</p>;
}

function List({ label, tone, items }: { label: string; tone: string; items: string[] }) {
  return (
    <div>
      <p className={`text-xs mb-1 ${tone}`}>{label}</p>
      <ul className="space-y-0.5 text-white">{items.map(i => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}

function Tile({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="bg-[var(--card-bg)] rounded-lg p-4">
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      {extra && <div className="mt-1">{extra}</div>}
    </div>
  );
}

function TrendsView() {
  const habits = useHabits();
  const tasks = useTasks();
  const storedHistory = useLiveQuery(() => getPreference(HISTORY_PREF), []);
  const storedSuggest = useLiveQuery(() => getPreference('suggest.settings'), []);

  const controls: SuggestControls = useMemo(() => {
    try {
      return storedSuggest ? { ...DEFAULT_SUGGEST_CONTROLS, ...JSON.parse(storedSuggest) } : DEFAULT_SUGGEST_CONTROLS;
    } catch { return DEFAULT_SUGGEST_CONTROLS; }
  }, [storedSuggest]);

  const history = useMemo(() => parseHistory(storedHistory), [storedHistory]);
  const days = useMemo(() => recentDays(WINDOW), []);
  const cal = useMemo(() => calibrate(history, days), [history, days]);

  const peak = Math.max(
    controls.dailyAPBudget,
    ...days.map((d) => history[d]?.spent ?? 0),
    1,
  );

  const activeHabits = habits.filter((h) => h.isActive);
  const finishedTotal = days.reduce((n, d) => n + (history[d]?.finished ?? 0), 0);

  return (
    <div>

      {/* Effort */}
      <section className="bg-[var(--card-bg)] rounded-lg p-5 mb-6">
        <h2 className="text-lg font-medium text-white mb-1">Your days</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Each bar is a day&rsquo;s effort. The line is the budget you had set for it.
        </p>

        {cal.days === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Nothing recorded yet. A day is written up the first time you open the app the
            following morning, so this fills in as you use it.
          </p>
        ) : (
          <>
            <div className="flex items-end gap-[3px] h-28 mb-2">
              {days.map((date) => {
                const record = history[date];
                const spent = record?.spent ?? 0;
                const capacity = record?.capacity ?? controls.dailyAPBudget;
                const over = spent > capacity;
                return (
                  <div key={date} className="flex-1 relative h-full flex flex-col justify-end"
                       title={`${format(parseLocalDate(date), 'EEE d MMM')} — ${spent} AP of ${capacity}`}>
                    {/* the budget for that day, drawn where it actually sat */}
                    <div className="absolute left-0 right-0 border-t border-dashed border-[var(--muted)]/40"
                         style={{ bottom: `${(capacity / peak) * 100}%` }} />
                    <div className={`rounded-t-sm ${over ? 'bg-amber-500' : 'bg-green-500/80'}`}
                         style={{ height: `${(spent / peak) * 100}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-[var(--muted)] mb-4">
              <span>{format(parseLocalDate(days[0]), 'd MMM')}</span>
              <span>{format(parseLocalDate(days[days.length - 1]), 'd MMM')}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Days recorded" value={String(cal.days)} />
              <Stat label="Budget you set" value={`${cal.averageCapacity} AP`} />
              <Stat label="What you spent" value={`${cal.averageSpent} AP`} />
              <Stat label="Days over" value={`${cal.overDays} of ${cal.days}`} />
            </div>

            <p className="text-sm text-[var(--muted)] mt-4">{verdict(cal)}</p>
          </>
        )}
      </section>

      {/* Throughput */}
      <section className="bg-[var(--card-bg)] rounded-lg p-5 mb-6">
        <h2 className="text-lg font-medium text-white mb-1">What you finished</h2>
        <p className="text-sm text-[var(--muted)]">
          <span className="text-white font-semibold">{finishedTotal}</span> things in the last {WINDOW} days
          {cal.days > 0 && <> — about {Math.round((finishedTotal / cal.days) * 10) / 10} on a day you did anything</>}.
          {' '}<span className="text-white font-semibold">{tasks.filter(t => t.status !== 'Done' && t.status !== 'Archived').length}</span> still open.
        </p>
      </section>

      {/* Habits */}
      <section className="bg-[var(--card-bg)] rounded-lg p-5">
        <h2 className="text-lg font-medium text-white mb-1">Habits</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          The run each one is on, and the last 30 days.
        </p>
        {activeHabits.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No active habits.</p>
        ) : (
          <div className="space-y-4">
            {activeHabits.map((habit) => (
              <div key={habit.id}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{habit.icon || '🔄'}</span>
                  <span className="text-white text-sm">{habit.habitName}</span>
                </div>
                <HabitHistory habit={habit} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--background)] rounded p-3">
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

/**
 * One sentence about the gap, or none.
 *
 * Deliberately not encouraging: the number is more use as a fact than as a
 * verdict, and a page that praises you for a light week is a page you stop
 * believing about a heavy one.
 */
function verdict(cal: ReturnType<typeof calibrate>): string {
  const gap = cal.averageSpent - cal.averageCapacity;
  if (cal.days < 5) return 'Not enough days yet to say much.';
  if (gap > 2) return `You spend about ${Math.round(gap)} AP more than you allow yourself. Either the budget is too low or the days are too full.`;
  if (gap < -2) return `You allow yourself about ${Math.round(-gap)} AP more than you spend. There may be room, or the budget may be aspirational.`;
  return 'Your budget and your days broadly agree.';
}
