'use client';

/**
 * Notifications: when to be told, and on which devices.
 *
 * The bell in the header always lists what applies right now. Pushes to a
 * phone or laptop are sent by the Pi, so they arrive whether or not the app
 * is open - but a browser only allows them once asked on that device.
 */

import { useEffect, useState } from 'react';

import { useLiveQuery } from '@/lib/live-query';
import { getPreference, getProfile, savePreference } from '@/lib/store';
import { NOTICE_SETTINGS_PREF, NoticeSettings, parseNoticeSettings } from '@/lib/notifications';

const inputClass = 'px-2 py-1 bg-[var(--background)] border border-[var(--border-color)] rounded text-sm text-white';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Browser';
}

export default function NotificationSettings() {
  const stored = useLiveQuery(() => getPreference(NOTICE_SETTINGS_PREF), []);
  const settings = parseNoticeSettings(stored);
  const [status, setStatus] = useState<string>('');
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<Array<{ endpoint: string; label: string | null }>>([]);

  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const iosNeedsInstall = typeof window !== 'undefined' && /iPhone|iPad/.test(navigator.userAgent) &&
    !window.matchMedia('(display-mode: standalone)').matches;

  const save = (next: NoticeSettings) => savePreference(NOTICE_SETTINGS_PREF, JSON.stringify(next));

  async function refresh() {
    const profile = getProfile();
    if (!profile) return;
    try {
      const res = await fetch(`/api/push?profile=${encodeURIComponent(profile)}`, { cache: 'no-store' });
      const body = await res.json() as { devices: Array<{ endpoint: string; label: string | null }> };
      setDevices(body.devices ?? []);
      if (supported) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub && (body.devices ?? []).some(d => d.endpoint === sub.endpoint));
      }
    } catch { /* offline; leave as is */ }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, []);

  async function enable() {
    setStatus('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('Notifications were not allowed. You can change that in the browser or phone settings.'); return; }
      const profile = getProfile();
      const res = await fetch(`/api/push?profile=${encodeURIComponent(profile)}`, { cache: 'no-store' });
      const { publicKey } = await res.json() as { publicKey: string };
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await fetch(`/api/push?profile=${encodeURIComponent(profile)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'subscribe', subscription: sub.toJSON(), label: deviceLabel() }),
      });
      setStatus('This device will get notifications.');
      await refresh();
    } catch (error) {
      setStatus(`Could not turn notifications on: ${(error as Error).message}`);
    }
  }

  async function disable() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/push?profile=${encodeURIComponent(getProfile())}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('This device will no longer get notifications.');
      await refresh();
    } catch (error) {
      setStatus(`Could not turn them off: ${(error as Error).message}`);
    }
  }

  async function test() {
    const res = await fetch(`/api/push?profile=${encodeURIComponent(getProfile())}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test' }),
    });
    const body = await res.json() as { sent?: number };
    setStatus(body.sent ? `Sent to ${body.sent} device${body.sent === 1 ? '' : 's'}.` : 'No device received it — turn notifications on first.');
  }

  const toggle = (key: keyof NoticeSettings['push'], label: string, hint: string) => (
    <label className="flex items-center justify-between gap-4 cursor-pointer py-1">
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-[var(--muted)]">{hint}</p>
      </div>
      <input type="checkbox" checked={settings.push[key]}
             onChange={(e) => save({ ...settings, push: { ...settings.push, [key]: e.target.checked } })}
             className="w-5 h-5 cursor-pointer" />
    </label>
  );

  return (
    <div className="bg-[var(--card-bg)] rounded-lg p-5 mb-6">
      <h2 className="text-lg font-medium text-white mb-1">Notifications</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        The 🔔 in the header always shows what needs you. Pushes are kept to a few a day: everything
        about the state of things is folded into one morning brief.
      </p>

      <div className="rounded border border-[var(--border-color)] p-3 mb-4">
        {!supported ? (
          <p className="text-sm text-[var(--muted)]">
            {iosNeedsInstall
              ? 'On iPhone, push only works from the Home Screen app: tap Share → Add to Home Screen, open LifeOS from the icon, then come back here.'
              : 'This browser cannot receive push notifications.'}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {subscribed ? (
              <button onClick={disable} className="px-3 py-1.5 rounded bg-[var(--card-hover)] text-white text-sm">Turn off on this device</button>
            ) : (
              <button onClick={enable} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">Turn on for this device</button>
            )}
            <button onClick={test} disabled={!devices.length} className="px-3 py-1.5 rounded border border-[var(--border-color)] text-sm text-[var(--muted)] hover:text-white disabled:opacity-40">
              Send a test
            </button>
            <span className="text-xs text-[var(--muted)]">
              {devices.length ? `On for: ${devices.map(d => d.label ?? 'device').join(', ')}` : 'No devices yet'}
            </span>
          </div>
        )}
        {status && <p className="text-xs text-[var(--muted)] mt-2">{status}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="text-sm text-[var(--muted)]">
          Morning brief at
          <input type="time" value={settings.briefTime} onChange={(e) => save({ ...settings, briefTime: e.target.value || '08:00' })}
                 className={`${inputClass} block mt-1 w-full`} />
        </label>
        <label className="text-sm text-[var(--muted)]">
          Evening check at
          <input type="time" value={settings.eveningTime} onChange={(e) => save({ ...settings, eveningTime: e.target.value || '20:00' })}
                 className={`${inputClass} block mt-1 w-full`} />
        </label>
        <label className="text-sm text-[var(--muted)] col-span-2">
          Remind me before timed events
          <select value={settings.eventLeadMinutes} onChange={(e) => save({ ...settings, eventLeadMinutes: parseInt(e.target.value) })}
                  className={`${inputClass} block mt-1 w-full`}>
            {[0, 5, 10, 15, 30, 60].map(m => <option key={m} value={m}>{m === 0 ? 'At the start' : `${m} minutes before`}</option>)}
          </select>
        </label>
      </div>

      <div className="divide-y divide-[var(--border-color)]">
        {toggle('brief', 'Morning brief', "Today's load, plus anything overdue, missed, blocked and pressing, to triage, or unticked from yesterday.")}
        {toggle('event', 'Event reminders', 'Before events that have a time.')}
        {toggle('habits', 'Evening habit check', 'Only when habits are still left for the day.')}
        {toggle('review', 'Weekly and monthly review', 'Sunday evening, and the last day of the month.')}
      </div>
    </div>
  );
}
