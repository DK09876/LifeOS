'use client';

/**
 * Reminders: the ones the app comes with, switched on or off with their
 * times, and your own - once, every day, or on chosen days.
 *
 * They are pushed by the Pi at their time to every device that has
 * notifications turned on, and appear in the 🔔 list from then.
 */

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useLiveQuery } from '@/lib/live-query';
import { getPreference, savePreference } from '@/lib/store';
import { getTodayString, parseLocalDate } from '@/lib/dates';
import { BuiltIn, NOTICE_SETTINGS_PREF, NoticeSettings, parseNoticeSettings } from '@/lib/notifications';
import { describeSchedule, formatTime, isPast, nextFiring, parseReminders, Reminder, ReminderRepeat, REMINDERS_PREF } from '@/lib/reminders';

const inputClass = 'w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const timeClass = 'px-2 py-1 bg-[var(--background)] border border-[var(--border-color)] rounded text-sm text-white';
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${on ? 'bg-blue-600' : 'bg-[var(--border-color)]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

type TimeField = 'briefTime' | 'middayTime' | 'eveningTime' | 'tomorrowTime';
const BUILT_INS: Array<{ key: BuiltIn; label: string; hint: string; time?: TimeField }> = [
  { key: 'brief', label: 'Morning brief', hint: "Today's load, plus anything overdue, missed, to triage or unticked from yesterday.", time: 'briefTime' },
  { key: 'midday', label: 'Midday tasks check', hint: "Which of today's tasks are still left. Skipped when they are all done.", time: 'middayTime' },
  { key: 'event', label: 'Before events', hint: 'Ahead of events that have a time.' },
  { key: 'habits', label: 'Evening habit check', hint: 'Only when habits are still left for the day.', time: 'eveningTime' },
  { key: 'tomorrow', label: 'Plan tomorrow', hint: "What tomorrow holds, while there is still time to change it.", time: 'tomorrowTime' },
  { key: 'review', label: 'Weekly and monthly review', hint: 'Sunday evening and the last day of the month, at the evening check time.' },
];

interface Draft {
  id: string | null;
  title: string;
  note: string;
  time: string;
  repeat: ReminderRepeat;
  date: string;
  weekdays: number[];
}

function blankDraft(): Draft {
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return { id: null, title: '', note: '', time: format(next, 'HH:mm'), repeat: 'once', date: format(next, 'yyyy-MM-dd'), weekdays: [] };
}

export default function RemindersPage() {
  const { showToast } = useToast();
  const storedSettings = useLiveQuery(() => getPreference(NOTICE_SETTINGS_PREF), []);
  const storedReminders = useLiveQuery(() => getPreference(REMINDERS_PREF), []);
  const settings = parseNoticeSettings(storedSettings);
  const reminders = parseReminders(storedReminders);
  const [draft, setDraft] = useState<Draft | null>(null);
  const now = new Date();

  const saveSettings = (next: NoticeSettings) => savePreference(NOTICE_SETTINGS_PREF, JSON.stringify(next));
  const saveReminders = (next: Reminder[]) => savePreference(REMINDERS_PREF, JSON.stringify(next));

  const upcoming = reminders.filter(r => !isPast(r, now))
    .sort((a, b) => (nextFiring(a, now) ?? '9999').localeCompare(nextFiring(b, now) ?? '9999') || a.title.localeCompare(b.title));
  const past = reminders.filter(r => isPast(r, now));

  function edit(r: Reminder) {
    setDraft({ id: r.id, title: r.title, note: r.note, time: r.time, repeat: r.repeat, date: r.date ?? getTodayString(), weekdays: r.weekdays });
  }

  async function submit() {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) { showToast('Give it a name', 'error'); return; }
    if (draft.repeat === 'days' && !draft.weekdays.length) { showToast('Pick at least one day', 'error'); return; }
    const stamp = new Date().toISOString();
    const fields = {
      title, note: draft.note.trim(), time: draft.time || '09:00', repeat: draft.repeat,
      date: draft.repeat === 'once' ? draft.date : null,
      weekdays: draft.repeat === 'days' ? draft.weekdays : [],
    };
    if (fields.repeat === 'once' && `${fields.date}T${fields.time}` < format(new Date(), "yyyy-MM-dd'T'HH:mm")) {
      showToast('That time has already passed', 'error');
      return;
    }
    const next = draft.id
      ? reminders.map(r => r.id === draft.id ? { ...r, ...fields, enabled: true, updatedAt: stamp } : r)
      : [...reminders, { id: crypto.randomUUID(), ...fields, enabled: true, createdAt: stamp, updatedAt: stamp }];
    try {
      await saveReminders(next);
      setDraft(null);
    } catch { showToast('Could not save that', 'error'); }
  }

  async function remove(id: string) {
    await saveReminders(reminders.filter(r => r.id !== id));
    setDraft(null);
  }

  const toggleReminder = (r: Reminder, enabled: boolean) =>
    saveReminders(reminders.map(x => x.id === r.id ? { ...x, enabled, updatedAt: new Date().toISOString() } : x));

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white mb-1">Reminders</h1>
        <p className="text-[var(--muted)]">
          Sent to every device with notifications on (<Link href="/settings" className="text-blue-400 hover:text-blue-300">Settings</Link>), and listed under 🔔.
        </p>
      </div>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium text-white">Your reminders</h2>
          <button onClick={() => setDraft(blankDraft())} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">+ New</button>
        </div>
        {upcoming.length === 0 && past.length === 0 && (
          <p className="text-sm text-[var(--muted)] bg-[var(--card-bg)] rounded-lg p-6 text-center">
            None yet. &ldquo;Take the bins out, Tuesdays at 7pm&rdquo;, &ldquo;Stretch, every day at 3pm&rdquo; …
          </p>
        )}
        <ul className="space-y-2">
          {upcoming.map(r => {
            const next = nextFiring(r, now);
            return (
              <li key={r.id} className="flex items-center gap-3 bg-[var(--card-bg)] rounded-lg px-4 py-3">
                <button onClick={() => edit(r)} className="flex-1 min-w-0 text-left">
                  <p className={`text-sm truncate ${r.enabled ? 'text-white' : 'text-[var(--muted)]'}`}>{r.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {describeSchedule(r)}
                    {r.enabled && next && r.repeat !== 'once' && <> · next {nextLabel(next)}</>}
                    {!r.enabled && ' · off'}
                  </p>
                  {r.note && <p className="text-xs text-[var(--muted)] truncate">{r.note}</p>}
                </button>
                <Switch on={r.enabled} onChange={(on) => toggleReminder(r, on)} label={`${r.title} on`} />
              </li>
            );
          })}
        </ul>
        {past.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-[var(--muted)] cursor-pointer">Done ({past.length})</summary>
            <ul className="mt-2 space-y-1">
              {past.map(r => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2 rounded-lg bg-[var(--card-bg)]/60">
                  <button onClick={() => edit(r)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm text-[var(--muted)] truncate line-through">{r.title}</p>
                    <p className="text-xs text-[var(--muted)]">{describeSchedule(r)}</p>
                  </button>
                  <button onClick={() => remove(r.id)} className="text-xs text-[var(--muted)] hover:text-red-400">Delete</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-white mb-3">Built in</h2>
        <ul className="bg-[var(--card-bg)] rounded-lg divide-y divide-[var(--border-color)]">
          {BUILT_INS.map(b => (
            <li key={b.key} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${settings.push[b.key] ? 'text-white' : 'text-[var(--muted)]'}`}>{b.label}</p>
                <p className="text-xs text-[var(--muted)]">{b.hint}</p>
              </div>
              {b.time && (
                <input type="time" aria-label={`${b.label} time`} value={settings[b.time]}
                       onChange={(e) => e.target.value && saveSettings({ ...settings, [b.time!]: e.target.value })}
                       className={timeClass} />
              )}
              {b.key === 'event' && (
                <select aria-label="How long before events" value={settings.eventLeadMinutes}
                        onChange={(e) => saveSettings({ ...settings, eventLeadMinutes: parseInt(e.target.value) })}
                        className={timeClass}>
                  {[0, 5, 10, 15, 30, 60].map(m => <option key={m} value={m}>{m === 0 ? 'At start' : `${m} min`}</option>)}
                </select>
              )}
              <Switch on={settings.push[b.key]} label={b.label}
                      onChange={(on) => saveSettings({ ...settings, push: { ...settings.push, [b.key]: on } })} />
            </li>
          ))}
        </ul>
      </section>

      <Modal isOpen={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit reminder' : 'New reminder'} maxWidth="sm">
        {draft && (
          <div className="space-y-4">
            <label className="block text-sm text-[var(--muted)]">
              Remind me to
              <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                     placeholder="Take the bins out" className={`${inputClass} mt-1`}
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }} />
            </label>
            <label className="block text-sm text-[var(--muted)]">
              Note <span className="text-xs">(optional)</span>
              <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className={`${inputClass} mt-1`} />
            </label>

            <div>
              <p className="text-sm text-[var(--muted)] mb-1">Repeat</p>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[var(--background)]">
                {([['once', 'Once'], ['daily', 'Every day'], ['days', 'Some days']] as const).map(([value, label]) => (
                  <button key={value} onClick={() => setDraft({ ...draft, repeat: value })}
                          className={`py-1.5 rounded text-sm ${draft.repeat === value ? 'bg-blue-600 text-white' : 'text-[var(--muted)] hover:text-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {draft.repeat === 'days' && (
              <div className="flex justify-between gap-1" role="group" aria-label="Days">
                {DAYS.map(d => {
                  const on = draft.weekdays.includes(d);
                  return (
                    <button key={d} aria-pressed={on}
                            aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]}
                            onClick={() => setDraft({ ...draft, weekdays: on ? draft.weekdays.filter(x => x !== d) : [...draft.weekdays, d] })}
                            className={`w-9 h-9 rounded-full text-sm ${on ? 'bg-blue-600 text-white' : 'bg-[var(--background)] text-[var(--muted)]'}`}>
                      {DAY_LETTER[d]}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {draft.repeat === 'once' && (
                <label className="block text-sm text-[var(--muted)]">
                  Day
                  <input type="date" value={draft.date} min={getTodayString()}
                         onChange={(e) => setDraft({ ...draft, date: e.target.value || getTodayString() })} className={`${inputClass} mt-1`} />
                </label>
              )}
              <label className="block text-sm text-[var(--muted)]">
                Time
                <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className={`${inputClass} mt-1`} />
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              {draft.id && (
                <button onClick={() => remove(draft.id!)} className="px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10">Delete</button>
              )}
              <div className="flex-1" />
              <button onClick={() => setDraft(null)} className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-white">Cancel</button>
              <button onClick={submit} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">Save</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function nextLabel(stamp: string): string {
  const [day, time] = stamp.split('T');
  const today = getTodayString();
  const when = day === today ? 'today' : format(parseLocalDate(day), 'EEE');
  return `${when} ${formatTime(time)}`;
}
