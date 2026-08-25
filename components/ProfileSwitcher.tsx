'use client';

/**
 * Switches which profile the app is showing.
 *
 * A native <select> renders with the operating system's own styling - white
 * background, blue highlight - which looks nothing like the rest of the app
 * on a dark theme. This is a plain button and menu using the app's own
 * variables instead.
 */

import { useEffect, useRef, useState } from 'react';

import { getProfile, listProfiles, setProfile, type Profile } from '@/lib/store';

export function ProfileSwitcher() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listProfiles().then(setProfiles).catch(() => {});
    setActive(getProfile());
  }, []);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (profiles.length === 0) return null;

  const activeName = profiles.find((p) => p.id === active)?.name ?? 'Profile';

  const choose = async (id: string) => {
    if (id === active) return setOpen(false);
    setBusy(true);
    setOpen(false);
    try {
      await setProfile(id);
      setActive(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm
                   bg-[var(--card-bg)] text-[var(--foreground)]
                   border border-[var(--border-color)]
                   hover:bg-[var(--card-hover)] transition-colors
                   disabled:opacity-60 disabled:cursor-wait"
      >
        <span
          aria-hidden
          className="w-5 h-5 rounded-full bg-[var(--accent-blue)] text-white
                     text-[11px] flex items-center justify-center font-medium"
        >
          {activeName.charAt(0).toUpperCase()}
        </span>
        <span>{busy ? 'Loading...' : activeName}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden
             className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M1 1L5 5L9 1" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 min-w-[10rem] py-1 z-50 rounded-md
                     bg-[var(--card-bg)] border border-[var(--border-color)]
                     shadow-lg shadow-black/40"
        >
          {profiles.map((profile) => (
            <button
              key={profile.id}
              role="menuitem"
              onClick={() => choose(profile.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                          hover:bg-[var(--card-hover)] transition-colors
                          ${profile.id === active
                            ? 'text-[var(--foreground)]'
                            : 'text-[var(--muted)]'}`}
            >
              <span className="w-4 text-[var(--accent-blue)]">
                {profile.id === active ? 'âœ“' : ''}
              </span>
              {profile.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
