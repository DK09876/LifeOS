'use client';

/**
 * Chooses which profile the app is showing, and loads it.
 *
 * The Pi holds every profile's data; this decides which one this browser is
 * looking at. Nothing is stored on the device, so switching is just a
 * re-fetch and any device can be either person.
 */

import { useCallback, useEffect, useState } from 'react';

import { getProfile, hydrate, isHydrated, listProfiles, setProfile, type Profile } from '@/lib/store';

export function ProfileGate({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const available = await listProfiles();
      setProfiles(available);
      const current = getProfile();
      if (current && available.some((p) => p.id === current)) {
        await hydrate();
        setActive(current);
        setReady(isHydrated());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const choose = async (id: string) => {
    setError(null);
    setReady(false);
    try {
      await setProfile(id);
      setActive(id);
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that profile');
    }
  };

  if (ready && active) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--background)]">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-medium text-white mb-1">LifeOS</h1>
        <p className="text-sm text-[var(--muted)] mb-5">Who is using this?</p>

        {error && (
          <p className="mb-4 text-sm text-red-400">{error}</p>
        )}

        <div className="space-y-2">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => choose(profile.id)}
              className="w-full px-4 py-3 text-left bg-[var(--card)] hover:bg-white/5 border border-white/10 rounded-lg text-white"
            >
              {profile.name}
            </button>
          ))}
          {!profiles.length && !error && (
            <p className="text-sm text-[var(--muted)]">
              No profiles yet. On the server run:
              <br />
              <code className="text-xs">node scripts/user.cjs add &lt;id&gt; &quot;&lt;name&gt;&quot;</code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small control for switching profile from inside the app. */
export function ProfileSwitcher() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState('');

  useEffect(() => {
    listProfiles().then(setProfiles).catch(() => {});
    setActive(getProfile());
  }, []);

  if (profiles.length < 2) return null;

  return (
    <select
      value={active}
      onChange={async (event) => {
        await setProfile(event.target.value);
        setActive(event.target.value);
      }}
      className="px-2 py-1 bg-[var(--card)] border border-white/10 rounded text-sm text-white"
      aria-label="Active profile"
    >
      {profiles.map((profile) => (
        <option key={profile.id} value={profile.id}>{profile.name}</option>
      ))}
    </select>
  );
}
