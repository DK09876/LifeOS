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

/** Used when this browser has no remembered choice. */
const DEFAULT_PROFILE = 'dk';

export function ProfileGate({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const available = await listProfiles();
      setProfiles(available);

      // Remembered choice wins; otherwise fall back to DK so a fresh browser
      // lands straight in the app rather than on a chooser. The picker below
      // is only for when neither is available.
      const remembered = getProfile();
      const fallback = available.find((p) => p.id === DEFAULT_PROFILE) ?? available[0];
      const chosen = available.some((p) => p.id === remembered)
        ? remembered
        : fallback?.id;

      if (chosen) {
        if (chosen !== remembered) {
          await setProfile(chosen);
        } else {
          await hydrate();
        }
        setActive(chosen);
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
              className="w-full px-4 py-3 text-left bg-[var(--card-bg)] hover:bg-white/5 border border-[var(--border-color)] rounded-lg text-white"
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
