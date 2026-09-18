'use client';

/**
 * Today's effort meter.
 *
 * Three numbers, because they answer different questions: capacity is what
 * the day is allowed to cost, done is what it has cost, and planned is what
 * is still coming. Showing only the burn-down would tell you that you were
 * over only once it was too late to choose otherwise.
 */

import { DayLoad } from '@/lib/capacity';

interface Props {
  capacity: number;
  load: DayLoad;
  onChange: (next: number) => void;
}

export default function DayCapacity({ capacity, load, onChange }: Props) {
  const { done, planned, committed } = load;
  const over = committed > capacity;
  // The bar is scaled to whichever is larger, so an overcommitted day still
  // shows its overflow instead of silently clipping at full.
  const scale = Math.max(capacity, committed, 1);
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`;

  return (
    <div className="bg-[var(--card-bg)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-[var(--muted)]">
          <span className="text-white font-semibold">{done}</span>
          {' of '}
          <span className="text-white font-semibold">{capacity}</span>
          {' AP used'}
          {planned > 0 && <span> · {planned} planned left</span>}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange(Math.max(0, capacity - 1))}
            className="w-6 h-6 rounded bg-[var(--background)] text-[var(--muted)] hover:text-white"
            aria-label="Lower today's capacity"
          >
            −
          </button>
          <button
            onClick={() => onChange(Math.min(30, capacity + 1))}
            className="w-6 h-6 rounded bg-[var(--background)] text-[var(--muted)] hover:text-white"
            aria-label="Raise today's capacity"
          >
            +
          </button>
        </div>
      </div>

      <div className="h-2 rounded-full bg-[var(--background)] overflow-hidden flex">
        <div className={over ? 'bg-amber-500' : 'bg-green-500'} style={{ width: pct(done) }} />
        <div className={over ? 'bg-amber-500/30' : 'bg-green-500/30'} style={{ width: pct(planned) }} />
      </div>

      {over && (
        // Stated, not scolded. A meter that lectures is a meter you stop reading.
        <p className="text-xs text-amber-400 mt-2">
          {committed} AP against {article(capacity)} {capacity} AP day.
          {done > capacity ? ' Worth a lighter tomorrow.' : ' Consider moving something.'}
        </p>
      )}
    </div>
  );
}

/** "an 8 AP day", not "a 8 AP day". Only 8, 11 and 18 take "an" here. */
function article(n: number): string {
  const s = String(n);
  return s.startsWith('8') || s === '11' || s.startsWith('18') ? 'an' : 'a';
}
