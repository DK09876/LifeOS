'use client';

/**
 * A habit's recent record: the run it is on, and the last 30 days as dots.
 *
 * The strip is the point. A number tells you where you are; the dots tell you
 * what your pattern actually looks like - whether you keep missing Mondays,
 * or whether a "broken" streak was one bad week in an otherwise solid month.
 */

import { Habit } from '@/types';
import { currentStreak, recentHistory } from '@/lib/streaks';

export default function HabitHistory({ habit }: { habit: Habit }) {
  const { current, unit, days } = currentStreak(habit.completionDates || [], habit.targetPerWeek);
  const history = recentHistory(habit.completionDates || [], 30);
  const best = habit.bestStreak ?? 0;
  const label = (n: number) => `${n} ${unit}${n === 1 ? '' : 's'}`;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-baseline gap-1.5">
        <span className={`text-sm font-semibold ${current > 0 || days > 0 ? 'text-orange-400' : 'text-[var(--muted)]'}`}>
          {current > 0 ? `🔥 ${label(current)}` : days > 0 ? `🔥 ${days} day${days === 1 ? '' : 's'}` : 'No streak'}
        </span>
        {/* On a targeted habit the weeks are the headline, but the day run is
            what you feel day to day, so show both once they differ. */}
        {unit === 'week' && current > 0 && days > 0 && (
          <span className="text-xs text-[var(--muted)]">{days} day{days === 1 ? '' : 's'} running</span>
        )}
        {best > 0 && (
          <span className="text-xs text-[var(--muted)]">best {label(best)}</span>
        )}
      </div>

      {/* Dots shrink to fit a narrow screen rather than pushing past it. */}
      <div className="flex items-end gap-[2px] sm:gap-[3px] w-full max-w-[300px] min-w-0" aria-label="Last 30 days">
        {history.map(day => (
          <span
            key={day.date}
            title={`${day.date}${day.done ? ' — done' : ''}`}
            className={[
              'flex-1 min-w-0 max-w-[7px] rounded-[2px]',
              day.done ? 'h-3 bg-green-500' : 'h-3 bg-[var(--background)] border border-[var(--border-color)]',
              // Weekends sit lower so the week boundaries are visible without
              // labels; today gets a ring so "have I done it yet" is instant.
              day.isWeekend && !day.done ? 'opacity-50' : '',
              day.isToday ? 'ring-1 ring-white/60' : '',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  );
}
