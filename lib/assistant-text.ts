/**
 * The two things voice gets wrong most: which item you meant, and which day.
 *
 * Speech gives "the dishes" for "Dishes", "laundry" for "Do laundry", and
 * "Saturday" rather than a date. These turn that into something exact - and
 * when a name could be two things, say so instead of guessing.
 */

import { addDays } from 'date-fns';

import { parseLocalDate, toDateString } from './dates';

export type Match<T> =
  | { kind: 'one'; item: T }
  | { kind: 'ambiguous'; items: T[] }
  | { kind: 'none' };

const FILLER = new Set(['the', 'a', 'an', 'my', 'to', 'do', 'go']);

export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
}

function words(text: string): string[] {
  return normalise(text).split(' ').filter((w) => w && !FILLER.has(w));
}

/** How well `query` names `name`, 0-100. */
export function nameScore(query: string, name: string): number {
  const q = normalise(query);
  const n = normalise(name);
  if (!q || !n) return 0;
  if (q === n) return 100;
  const qw = words(query);
  const nw = words(name);
  if (qw.length && qw.join(' ') === nw.join(' ')) return 95;
  if (n.startsWith(q)) return 80;
  if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(n)) return 70;
  // Plurals and word forms: "dish" for "dishes", "meditation" for "meditate".
  // Two words count as the same when they share most of their start.
  const stem = (w: string) => w.replace(/(es|s)$/, '');
  const qs = qw.map(stem);
  const ns = nw.map(stem);
  const same = (a: string, b: string) => {
    if (a === b) return true;
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i >= 5 && i >= Math.min(a.length, b.length) - 2;
  };
  const shared = qs.filter((w) => ns.some((n) => same(w, n))).length;
  if (!shared) return n.includes(q) ? 40 : 0;
  return Math.round(60 * (shared / Math.max(qs.length, ns.length)));
}

/**
 * The item a spoken name refers to. Two or more equally good matches are
 * ambiguous - asking "dishes or dishes unloaded?" beats picking one.
 */
export function findByName<T>(items: T[], query: string, nameOf: (item: T) => string): Match<T> {
  const scored = items
    .map((item) => ({ item, score: nameScore(query, nameOf(item)) }))
    .filter((s) => s.score >= 40)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return { kind: 'none' };
  const best = scored[0].score;
  const tied = scored.filter((s) => s.score === best);
  if (tied.length === 1) return { kind: 'one', item: tied[0].item };
  const distinct = new Map(tied.map((s) => [normalise(nameOf(s.item)), s.item]));
  if (distinct.size === 1) return { kind: 'one', item: tied[0].item };
  return { kind: 'ambiguous', items: [...distinct.values()] };
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * A spoken or written day as YYYY-MM-DD, relative to `today`. Weekday names
 * mean the next one (today counts), "next Friday" the one after that.
 * Returns null when it is not a day this understands.
 */
export function resolveDay(input: string | null | undefined, today: string): string | null {
  if (!input) return null;
  const text = normalise(input);
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) return input.trim();
  const base = parseLocalDate(today);
  if (['today', 'tonight', 'this evening', 'this morning', 'this afternoon'].includes(text)) return today;
  if (text === 'tomorrow') return toDateString(addDays(base, 1));
  if (text === 'yesterday') return toDateString(addDays(base, -1));
  const inDays = text.match(/^in (\d+) days?$/);
  if (inDays) return toDateString(addDays(base, parseInt(inDays[1], 10)));
  if (text === 'this weekend' || text === 'weekend') return resolveDay('saturday', today);
  if (text === 'next week') return resolveDay('next monday', today);

  const day = text.replace(/^(this|on) /, '');
  const next = day.startsWith('next ');
  const name = day.replace(/^next /, '');
  const idx = WEEKDAYS.indexOf(name);
  if (idx >= 0) {
    if (next) {
      // "next Friday" is Friday of next week (Mon-Sun), whatever today is.
      const toNextMonday = ((8 - base.getDay()) % 7) || 7;
      return toDateString(addDays(base, toNextMonday + ((idx + 6) % 7)));
    }
    return toDateString(addDays(base, (idx - base.getDay() + 7) % 7));
  }

  // "the 30th", "30th", "30"
  const dom = text.match(/^(?:the )?(\d{1,2})(?:st|nd|rd|th)?$/);
  if (dom) {
    const n = parseInt(dom[1], 10);
    if (n >= 1 && n <= 31) {
      for (let i = 0; i < 62; i++) {
        const d = addDays(base, i);
        if (d.getDate() === n) return toDateString(d);
      }
    }
  }
  return null;
}

/** "Mon 12 Oct" style, for reading a date back. */
export function sayDay(date: string, today: string): string {
  if (date === today) return 'today';
  const t = parseLocalDate(today);
  const d = parseLocalDate(date);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  const weekday = WEEKDAYS[d.getDay()];
  const cap = weekday[0].toUpperCase() + weekday.slice(1);
  if (diff > 1 && diff < 7) return cap;
  const month = d.toLocaleString('en-US', { month: 'long' });
  return `${cap} ${month} ${d.getDate()}`;
}

/** "a, b and c" */
export function listing(items: string[], max = 5): string {
  if (!items.length) return '';
  const shown = items.slice(0, max);
  const more = items.length - shown.length;
  const tail = more > 0 ? [`${more} more`] : [];
  const all = [...shown, ...tail];
  return all.length === 1 ? all[0] : `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`;
}
