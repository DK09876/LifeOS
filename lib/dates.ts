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
