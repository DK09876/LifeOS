'use client';

/**
 * How much a day is allowed to cost.
 *
 * One default, optionally different per weekday - lighter on workdays,
 * bigger at the weekend. A single day can still be changed on Today without
 * touching any of this.
 */

import { useMemo } from 'react';

import { useEnergySettings } from '@/lib/hooks';
import { useLiveQuery } from '@/lib/live-query';
import { getPreference, savePreference } from '@/lib/store';
import { WEEKDAY_BUDGET_PREF } from '@/lib/capacity';
import { HISTORY_PREF, parseHistory } from '@/lib/history';
import { parseLocalDate } from '@/lib/dates';

/** Monday first for display; values are indexed by Date.getDay(). */
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function EnergySettings() {
  const energy = useEnergySettings();
  const storedHistory = useLiveQuery(() => getPreference(HISTORY_PREF), []);
  const weekdays = energy.weekdayBudget ?? [null, null, null, null, null, null, null];
  const daily = energy.controls.dailyAPBudget;

  const saveDaily = (value: number) =>
    savePreference('suggest.settings', JSON.stringify({ ...energy.controls, dailyAPBudget: value }));
  const saveWeekdays = (next: Array<number | null>) =>
    savePreference(WEEKDAY_BUDGET_PREF, JSON.stringify(next));

  // What each weekday has actually cost, on days anything was recorded.
  const actual = useMemo(() => {
    const history = parseHistory(storedHistory);
    const sums = Array.from({ length: 7 }, () => ({ total: 0, days: 0 }));
    for (const [date, record] of Object.entries(history)) {
      if (record.spent <= 0) continue;
      const d = parseLocalDate(date).getDay();
      sums[d].total += record.spent;
      sums[d].days += 1;
    }
    return sums.map(s => (s.days >= 2 ? Math.round(s.total / s.days) : null));
  }, [storedHistory]);
  const hasActual = actual.some(v => v !== null);

  return (
    <div className="bg-[var(--card-bg)] rounded-lg p-5 mb-6">
      <h2 className="text-lg font-medium text-white mb-1">Daily energy</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        How many AP a day may cost. Today&rsquo;s meter, the planner and your review all use this.
      </p>

      <label className="flex items-center gap-3 mb-4">
        <span className="text-sm text-white w-28">Every day</span>
        <input type="range" min={1} max={20} value={daily} onChange={(e) => saveDaily(parseInt(e.target.value))}
               className="flex-1 accent-blue-500" aria-label="Daily AP budget" />
        <span className="text-sm text-white w-10 text-right">{daily} AP</span>
      </label>

      <p className="text-sm text-white mb-2">By weekday <span className="text-[var(--muted)]">(blank uses {daily})</span></p>
      <div className="grid grid-cols-7 gap-1">
        {ORDER.map(day => (
          <label key={day} className="text-center">
            <span className="block text-xs text-[var(--muted)] mb-1">{NAMES[day]}</span>
            <input type="number" min={0} max={30} inputMode="numeric"
                   value={weekdays[day] ?? ''} placeholder={String(daily)} aria-label={`${NAMES[day]} AP budget`}
                   onChange={(e) => {
                     const next = [...weekdays];
                     next[day] = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0);
                     void saveWeekdays(next);
                   }}
                   className="w-full px-1 py-1.5 bg-[var(--background)] border border-[var(--border-color)] rounded text-sm text-center text-white" />
            {actual[day] !== null && <span className="block text-[10px] text-[var(--muted)] mt-0.5">spent ~{actual[day]}</span>}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {hasActual && (
          <button onClick={() => saveWeekdays(actual)} className="text-xs text-blue-400 hover:text-blue-300">
            Use what I actually spend
          </button>
        )}
        {energy.weekdayBudget && (
          <button onClick={() => saveWeekdays([null, null, null, null, null, null, null])} className="text-xs text-[var(--muted)] hover:text-white">
            Clear weekday budgets
          </button>
        )}
      </div>
    </div>
  );
}
