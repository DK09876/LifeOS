'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Sidebar from './Sidebar';
import { initGoogleAuth, signInWithGoogle, signOut, getStoredAuth, GoogleUser } from '@/lib/google-auth';
import { syncWithGoogleDrive, getSyncStatus } from '@/lib/sync';
import { seedDatabase } from '@/lib/seed';
import { getDailyQuote, fetchDailyQuote, Quote } from '@/lib/quotes';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [quote, setQuote] = useState<Quote>(getDailyQuote());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        // seedDatabase() disabled — users start with a clean slate
        await initGoogleAuth();
        const storedUser = getStoredAuth();
        setUser(storedUser);
        const status = await getSyncStatus();
        setLastSynced(status.lastSyncedAt);
        if (storedUser) {
          handleSync();
        }
        // Fetch daily quote
        const liveQuote = await fetchDailyQuote();
        setQuote(liveQuote);
      } catch (err) {
        console.error('Failed to initialize:', err);
      } finally {
        setInitialized(true);
      }
    }
    init();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncWithGoogleDrive();
      setSyncMessage(result.message);
      if (result.lastSyncedAt) {
        setLastSynced(result.lastSyncedAt);
      }
      setTimeout(() => setSyncMessage(null), 3000);
    } catch {
      setSyncMessage('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSignIn = async () => {
    try {
      const googleUser = await signInWithGoogle();
      setUser(googleUser);
      handleSync();
    } catch (error) {
      console.error('Sign in failed:', error);
      setSyncMessage('Sign in failed');
    }
  };

  const handleSignOut = () => {
    signOut();
    setUser(null);
    setLastSynced(null);
  };

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/50 mx-auto"></div>
          <p className="mt-4 text-[var(--muted)]">Loading LifeOS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Main content area */}
      <div className={`${sidebarCollapsed ? 'ml-14' : 'ml-56'} transition-all duration-200`}>
        {/* Top bar */}
        <header className="h-14 border-b border-[var(--border-color)] flex items-center px-6 gap-4 sticky top-0 bg-[var(--background)] z-10">
          {/* Quote */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[var(--muted)] italic truncate">
              "{quote.text}" — {quote.author}
            </p>
          </div>
          {user ? (
            <>
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                {user.picture && (
                  <Image src={user.picture} alt={user.name} width={24} height={24} className="rounded-full" />
                )}
                <span className="hidden sm:inline">{user.email}</span>
              </div>
              {lastSynced && (
                <span className="text-xs text-[var(--muted)] hidden md:inline">
                  Synced: {new Date(lastSynced).toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-sm"
              >
                {syncing ? 'Syncing...' : 'Sync'}
              </button>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 text-[var(--muted)] hover:text-white text-sm"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              disabled
              className="px-4 py-1.5 bg-blue-600/50 text-white/50 rounded text-sm cursor-not-allowed"
              title="Coming soon"
            >
              Sign in with Google
            </button>
          )}
          {syncMessage && (
            <span className={`text-sm ${syncMessage.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
              {syncMessage}
            </span>
          )}
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
