'use client';

/**
 * Nags once a month to copy the database off the Pi.
 *
 * Snapshots live on the same SD card as the database, so they survive
 * mistakes and corruption but not the card failing. Until that copy is
 * scripted, this is the reminder to do it by hand.
 *
 * The timestamp is stored server-side, not per browser, so confirming on
 * one device settles it everywhere.
 */

import { useEffect, useRef } from 'react';

import { backupReminderDetail, isBackupDue } from '@/lib/backup-reminder';
import { useToast } from './Toast';

export function BackupReminder() {
  const { showToast } = useToast();
  // React runs effects twice in development; without this the toast doubles.
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    (async () => {
      try {
        const response = await fetch('/api/system', { cache: 'no-store' });
        if (!response.ok) return;
        const { backupLastConfirmedAt } = (await response.json()) as {
          backupLastConfirmedAt: string | null;
        };

        if (!isBackupDue(backupLastConfirmedAt)) return;

        showToast(
          `Back up your data to your PC. ${backupReminderDetail(backupLastConfirmedAt)}`,
          'info',
          {
            action: {
              label: 'Done',
              onClick: async () => {
                await fetch('/api/system', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ confirmBackup: true }),
                });
              },
            },
          },
        );
      } catch {
        // A reminder is not worth surfacing an error over.
      }
    })();
  }, [showToast]);

  return null;
}
