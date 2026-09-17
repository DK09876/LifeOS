import { format, startOfDay } from 'date-fns';

/**
 * Format a Date object to a YYYY-MM-DD string for storage and comparison.
 * This is the canonical format for date fields in the database.
 */
export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Parse a date string (YYYY-MM-DD) as local midnight.
 *
 * IMPORTANT: Do NOT use `new Date("2026-02-04")` directly!
 * That creates midnight UTC, which can be the previous day in local timezone.
 *
 * This function appends T00:00:00 to parse as local time instead.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

/**
 * Get today's date as a YYYY-MM-DD string.
 */
export function getTodayString(): string {
  return toDateString(new Date());
}

/**
 * Check if a date string matches today.
 */
export function isDateToday(dateStr: string): boolean {
  return dateStr === getTodayString();
}

/**
 * Get the start of today as a Date object (midnight local time).
 */
export function getStartOfToday(): Date {
  return startOfDay(new Date());
}

/**
 * Parse a stored moment that may be either a full ISO timestamp or a
 * date-only string.
 *
 * doneDate has two writers: the web app records an exact timestamp, while
 * the voice assistant records a plain YYYY-MM-DD. Passing the date-only form
 * to `new Date()` parses it as UTC midnight, which is the previous evening
 * in any western timezone - so a task completed today was reported as
 * completed yesterday. Date-only values are read as local midnight instead.
 */
export function parseLocalDateTime(value: string): Date {
  return value.length === 10 ? parseLocalDate(value) : new Date(value);
}
