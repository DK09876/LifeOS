import { describe, expect, it } from 'vitest';

import { BACKUP_INTERVAL_DAYS, backupReminderDetail, isBackupDue } from './backup-reminder';

const NOW = new Date('2026-08-26T12:00:00.000Z');
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();

describe('isBackupDue', () => {
  it('is due when never confirmed', () => {
    expect(isBackupDue(null, NOW)).toBe(true);
    expect(isBackupDue(undefined, NOW)).toBe(true);
  });

  it('is not due immediately after confirming', () => {
    expect(isBackupDue(daysAgo(0), NOW)).toBe(false);
    expect(isBackupDue(daysAgo(29), NOW)).toBe(false);
  });

  it('becomes due once the interval has fully elapsed', () => {
    expect(isBackupDue(daysAgo(BACKUP_INTERVAL_DAYS), NOW)).toBe(false);
    expect(isBackupDue(daysAgo(BACKUP_INTERVAL_DAYS + 1), NOW)).toBe(true);
  });

  // A bad value must not silently switch the reminder off forever.
  it('treats an unparseable timestamp as never confirmed', () => {
    expect(isBackupDue('not a date', NOW)).toBe(true);
    expect(isBackupDue('', NOW)).toBe(true);
  });
});

describe('backupReminderDetail', () => {
  it('says never when there is nothing recorded', () => {
    expect(backupReminderDetail(null)).toBe('Never copied off the Pi.');
    expect(backupReminderDetail('garbage')).toBe('Never copied off the Pi.');
  });

  it('reports the date when there is one', () => {
    expect(backupReminderDetail(daysAgo(40))).toMatch(/^Last copied /);
  });
});
