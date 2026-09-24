/**
 * The clock on the Pi that turns notices into pushes.
 *
 * Once a minute, for each profile with a subscribed device, it builds the same
 * notices the app's bell shows (lib/notifications) from the stored data, and
 * pushes any whose time has come and that have not been pushed before.
 */

import type { Event, Habit, Task } from '@/types';
import { buildNotices, isDueToPush, NOTICE_SETTINGS_PREF, parseNoticeSettings } from '@/lib/notifications';
import { CAPACITY_PREF, WEEKDAY_BUDGET_PREF, capacityFor, parseCapacityMap, parseWeekdayBudget } from '@/lib/capacity';
import { DEFAULT_SUGGEST_CONTROLS } from '@/lib/suggest';
import { toDateString } from '@/lib/dates';
import { markPushed, prunePushed, readPayload, usersWithPush, wasPushed } from './store';
import { pushToProfile } from './push';

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
  });

  let pushed = 0;
  for (const notice of notices) {
    if (!isDueToPush(notice, now) || wasPushed(userId, notice.key)) continue;
    // Recorded first: a send that half-fails must not repeat every minute.
    markPushed(userId, notice.key);
    const result = await pushToProfile(userId, { title: notice.title, body: notice.body, url: notice.href, tag: notice.key });
    pushed += result.sent;
  }
  return pushed;
}
