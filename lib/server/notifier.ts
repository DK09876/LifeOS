/**
 * The clock on the Pi that turns notices into pushes.
 *
 * Once a minute, for each profile with a subscribed device, it builds the same
 * notices the app's bell shows (lib/notifications) from the stored data, and
 * pushes any whose time has come and that have not been pushed before.
 */

import type { Event, Habit, Task } from '@/types';
import { buildNotices, combineNotices, isDueToPush, NOTICE_SETTINGS_PREF, parseNoticeSettings } from '@/lib/notifications';
import { CAPACITY_PREF, WEEKDAY_BUDGET_PREF, capacityFor, parseCapacityMap, parseWeekdayBudget } from '@/lib/capacity';
import { DEFAULT_SUGGEST_CONTROLS } from '@/lib/suggest';
import { toDateString } from '@/lib/dates';
import { markPushed, prunePushed, readPayload, usersWithPush, wasPushed } from './store';
import { pushToProfile } from './push';
import { parseReminders, REMINDERS_PREF } from '@/lib/reminders';

const TICK_MS = 60_000;

declare global {
  var __lifeosNotifier: ReturnType<typeof setInterval> | undefined;
}

export function startNotifier() {
  // Dev reloads and multiple imports must not start a second clock.
  if (globalThis.__lifeosNotifier) return;
  globalThis.__lifeosNotifier = setInterval(() => { void tick(); }, TICK_MS);
  void tick();
  console.log('[notifier] started');
}

export async function tick(now = new Date()): Promise<number> {
  let pushed = 0;
  try {
    prunePushed(new Date(now.getTime() - 7 * 86400000).toISOString());
    for (const userId of usersWithPush()) pushed += await tickProfile(userId, now);
  } catch (error) {
    console.error('[notifier] tick failed', error);
  }
  return pushed;
}

async function tickProfile(userId: string, now: Date): Promise<number> {
  const payload = readPayload(userId);
  const prefs = payload.preferences ?? {};
  const settings = parseNoticeSettings(prefs[NOTICE_SETTINGS_PREF]);
  let controls = DEFAULT_SUGGEST_CONTROLS;
  try { if (prefs['suggest.settings']) controls = { ...controls, ...JSON.parse(prefs['suggest.settings']) }; } catch { /* defaults */ }
  const budget = capacityFor(
    parseCapacityMap(prefs[CAPACITY_PREF]), toDateString(now), controls.dailyAPBudget,
    parseWeekdayBudget(prefs[WEEKDAY_BUDGET_PREF]),
  );

  const notices = buildNotices({
    tasks: (payload.tasks ?? []) as unknown as Task[],
    habits: (payload.habits ?? []) as unknown as Habit[],
    events: (payload.events ?? []) as unknown as Event[],
    settings, budget, defaultAP: controls.defaultAP, now,
    reminders: parseReminders(prefs[REMINDERS_PREF]),
  });

  // Everything due now goes out as one push, not a burst of them.
  const due = notices.filter((n) => isDueToPush(n, now) && !wasPushed(userId, n.key));
  if (!due.length) return 0;
  const attemptKey = `${userId}:${due.map((n) => n.key).sort().join('|')}`;
  const tries = (attempts.get(attemptKey) ?? 0) + 1;
  attempts.set(attemptKey, tries);
  const result = await pushToProfile(userId, combineNotices(due));
  // Delivered, or tried enough: never again. A failure used to be marked as
  // sent too, so a week of rejected pushes looked exactly like a week of
  // delivered ones. Now a failure gets a few more tries a few minutes apart.
  if (result.sent > 0 || result.failed === 0 || tries >= MAX_TRIES) {
    for (const n of due) markPushed(userId, n.key);
    attempts.delete(attemptKey);
  }
  return result.sent;
}

const MAX_TRIES = 3;
const attempts = new Map<string, number>();
