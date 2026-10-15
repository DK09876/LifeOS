/**
 * Reminders you set yourself: "take the bins out, Tuesdays at 7pm".
 *
 * Kept as one preference rather than a collection - a handful of small rows
 * that the notifier on the Pi and the bell in the app both read, and that
 * nothing else needs to query.
 */

import { addDays, format } from 'date-fns';

import { parseLocalDate, toDateString } from './dates';

export type ReminderRepeat = 'once' | 'daily' | 'days';

export interface Reminder {
  id: string;
  title: string;
  note: string;
  /** HH:mm, local time. */
  time: string;
  repeat: ReminderRepeat;
  /** The day, for a one-off. */
  date: string | null;
  /** 0 = Sunday … 6 = Saturday, for 'days'. */
  weekdays: number[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const REMINDERS_PREF = 'reminders.custom';

export function parseReminders(raw: string | undefined): Reminder[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((r): r is Reminder => !!r && typeof r === 'object' && typeof (r as Reminder).id === 'string') : [];
  } catch {
    return [];
  }
}

/** Whether a reminder goes off on a given day (enabled or not). */
export function occursOn(reminder: Reminder, day: string): boolean {
  switch (reminder.repeat) {
    case 'once': return reminder.date === day;
    case 'daily': return true;
    case 'days': return reminder.weekdays.includes(parseLocalDate(day).getDay());
    default: return false;
  }
}

/** The next local 'YYYY-MM-DDTHH:mm' it goes off at or after `now`, if any. */
export function nextFiring(reminder: Reminder, now: Date): string | null {
  if (!reminder.enabled) return null;
  const today = toDateString(now);
  const nowStamp = format(now, "yyyy-MM-dd'T'HH:mm");
  for (let i = 0; i < 8; i++) {
    const day = toDateString(addDays(parseLocalDate(today), i));
    const stamp = `${day}T${reminder.time}`;
    if (occursOn(reminder, day) && stamp >= nowStamp) return stamp;
  }
  return null;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Every day at 12:00", "Mon, Wed at 19:00", "Sat 18 Oct at 09:30". */
export function describeSchedule(reminder: Pick<Reminder, 'repeat' | 'date' | 'weekdays' | 'time'>): string {
  const time = formatTime(reminder.time);
  if (reminder.repeat === 'daily') return `Every day at ${time}`;
  if (reminder.repeat === 'days') {
    const days = [...reminder.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return `Weekdays at ${time}`;
    if (days.length === 2 && days.includes(0) && days.includes(6)) return `Weekends at ${time}`;
    return `${days.map((d) => DAY_NAMES[d]).join(', ') || 'No days'} at ${time}`;
  }
  return reminder.date ? `${format(parseLocalDate(reminder.date), 'EEE d MMM')} at ${time}` : `Once at ${time}`;
}

/** 24h "19:00" as the phone shows it, e.g. "7:00 pm". */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const d = new Date(2000, 0, 1, h, m);
  return format(d, 'h:mm a').toLowerCase();
}

/** A one-off whose moment has gone: kept so it can be seen, but done. */
export function isPast(reminder: Reminder, now: Date): boolean {
  return reminder.repeat === 'once' && !!reminder.date && `${reminder.date}T${reminder.time}` < format(now, "yyyy-MM-dd'T'HH:mm");
}
