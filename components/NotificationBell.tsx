'use client';

/**
 * The bell: everything the app currently has to tell you, in one place.
 *
 * Built from the same rules the Pi uses to push (lib/notifications), so what
 * buzzed on your phone is what is waiting here. Dismissing hides a notice for
 * that day only; tomorrow's version of it comes back if it is still true.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { useEnergySettings, useEvents, useHabits, useTasks } from '@/lib/hooks';
import { useLiveQuery } from '@/lib/live-query';
import { getPreference, savePreference } from '@/lib/store';
import { getTodayString } from '@/lib/dates';
import {
  buildNotices, isVisible, Notice, NOTICE_DISMISSED_PREF, NOTICE_SETTINGS_PREF,
  parseDismissed, parseNoticeSettings, pruneDismissed,
} from '@/lib/notifications';

const LEVEL_STYLE: Record<Notice['level'], string> = {
  urgent: 'border-l-red-500',
  warn: 'border-l-amber-500',
  info: 'border-l-blue-500',
};

export default function NotificationBell() {
  const tasks = useTasks();
  const habits = useHabits();
  const events = useEvents();
  const energy = useEnergySettings();
  const storedSettings = useLiveQuery(() => getPreference(NOTICE_SETTINGS_PREF), []);
  const storedDismissed = useLiveQuery(() => getPreference(NOTICE_DISMISSED_PREF), []);
  const [open, setOpen] = useState(false);
  // Re-evaluated each minute so timed notices appear when they fall due.
  const [now, setNow] = useState(() => new Date());
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!panel.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const dismissed = useMemo(() => parseDismissed(storedDismissed), [storedDismissed]);
  const notices = useMemo(() => {
    const today = getTodayString();
    return buildNotices({
      tasks, habits, events,
      settings: parseNoticeSettings(storedSettings),
      budget: energy.budgetFor(today),
      defaultAP: energy.controls.defaultAP,
      now,
    }).filter(n => isVisible(n, now) && !dismissed[n.key]);
  }, [tasks, habits, events, storedSettings, energy, now, dismissed]);

  // The brief is a summary of the rest, so it does not count toward the badge.
  const count = notices.filter(n => n.kind !== 'brief').length;
  const urgent = notices.some(n => n.level === 'urgent');

  const dismiss = (keys: string[]) => {
    const today = getTodayString();
    const next = pruneDismissed({ ...dismissed, ...Object.fromEntries(keys.map(k => [k, today])) }, today);
    void savePreference(NOTICE_DISMISSED_PREF, JSON.stringify(next));
  };

  return (
    <div className="relative" ref={panel}>
      <button onClick={() => setOpen(!open)} aria-label={`Notifications${count ? ` (${count})` : ''}`} aria-expanded={open}
              className="relative p-2 rounded hover:bg-[var(--card-bg)] text-lg leading-none">
        🔔
        {count > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center ${urgent ? 'bg-red-600' : 'bg-blue-600'}`}>
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-1.5rem))] max-h-[70vh] overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] shadow-xl z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
            <span className="text-sm font-medium text-white">Notifications</span>
            {notices.length > 0 && (
              <button onClick={() => dismiss(notices.map(n => n.key))} className="text-xs text-[var(--muted)] hover:text-white">
                Clear all
              </button>
            )}
          </div>
          {notices.length === 0 ? (
            <p className="p-4 text-sm text-[var(--muted)]">Nothing needs you right now.</p>
          ) : (
            <ul>
              {notices.map(n => (
                <li key={n.key} className={`border-l-4 ${LEVEL_STYLE[n.level]} border-b border-b-[var(--border-color)] last:border-b-0`}>
                  <div className="flex items-start gap-2 px-3 py-2">
                    <Link href={n.href} onClick={() => setOpen(false)} className="flex-1 min-w-0">
                      <p className="text-sm text-white">{n.title}</p>
                      <p className="text-xs text-[var(--muted)] line-clamp-2">{n.body}</p>
                    </Link>
                    <button onClick={() => dismiss([n.key])} aria-label="Dismiss" className="text-xs text-[var(--muted)] hover:text-white px-1">✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/settings" onClick={() => setOpen(false)} className="block px-3 py-2 text-xs text-blue-400 hover:text-blue-300 border-t border-[var(--border-color)]">
            Notification settings →
          </Link>
        </div>
      )}
    </div>
  );
}
