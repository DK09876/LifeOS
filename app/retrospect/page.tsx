'use client';

/**
 * Looking back.
 *
 * Every other page is about what to do next. This one is the only place the
 * app says anything about you rather than about your list: whether the budget
 * you set matches the days you actually have, and whether the habits you keep
 * saying you will keep are being kept.
 */

import { useMemo } from 'react';
import { format } from 'date-fns';

import HabitHistory from '@/components/HabitHistory';
import { useHabits, useTasks } from '@/lib/hooks';
import { useLiveQuery } from '@/lib/live-query';
import { getPreference } from '@/lib/store';
import { calibrate, HISTORY_PREF, parseHistory, recentDays } from '@/lib/history';
import { DEFAULT_SUGGEST_CONTROLS, SuggestControls } from '@/lib/suggest';
import { parseLocalDate } from '@/lib/dates';

const WINDOW = 28;

export default function RetrospectPage() {
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
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Retrospect</h1>
        <p className="text-[var(--muted)]">The last four weeks, and what they say</p>
      </div>

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
