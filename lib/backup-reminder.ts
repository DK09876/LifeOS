/**
 * When to nag about copying the database off the Pi.
 *
 * Pulled out of the component so the interval logic can be tested without
 * rendering anything.
 */

export const BACKUP_INTERVAL_DAYS = 30;

const DAY_MS = 86_400_000;

/**
 * True when a reminder is owed. Never confirmed counts as owed.
 *
 * `hasData` gates it: nagging someone to back up an empty profile is noise on
 * the one screen where a first impression is being formed.
 */
export function isBackupDue(
  lastConfirmedAt: string | null | undefined,
  now: Date = new Date(),
  hasData = true,
): boolean {
  if (!hasData) return false;
  if (!lastConfirmedAt) return true;
  const last = new Date(lastConfirmedAt).getTime();
  // An unparseable timestamp is treated as never confirmed rather than
  // silently suppressing the reminder forever.
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > BACKUP_INTERVAL_DAYS * DAY_MS;
}

/** The trailing sentence in the reminder. */
export function backupReminderDetail(lastConfirmedAt: string | null | undefined): string {
  if (!lastConfirmedAt) return 'Never copied off the Pi.';
  const last = new Date(lastConfirmedAt);
  if (Number.isNaN(last.getTime())) return 'Never copied off the Pi.';
  return `Last copied ${last.toLocaleDateString()}.`;
}
