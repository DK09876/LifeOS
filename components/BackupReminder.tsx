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
import { useTasks, useHabits, useEvents, useProjects } from '@/lib/hooks';
import { useToast } from './Toast';

export function BackupReminder() {
  const { showToast } = useToast();
  const tasks = useTasks();
  const habits = useHabits();
  const events = useEvents();
  const projects = useProjects();
  const hasData = tasks.length + habits.length + events.length + projects.length > 0;
  // React runs effects twice in development; without this the toast doubles.
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    // Wait for the store to hydrate before deciding; an empty first render
    // would otherwise suppress the reminder for the whole session.
    if (!hasData) return;
    checked.current = true;

    (async () => {
      try {
        const response = await fetch('/api/system', { cache: 'no-store' });
        if (!response.ok) return;
        const { backupLastConfirmedAt } = (await response.json()) as {
          backupLastConfirmedAt: string | null;
        };

        if (!isBackupDue(backupLastConfirmedAt, new Date(), hasData)) return;

        showToast(
          `Download a backup from Settings. ${backupReminderDetail(backupLastConfirmedAt)}`,
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
  }, [showToast, hasData]);

  return null;
}
