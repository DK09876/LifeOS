'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Sidebar from './Sidebar';
import ConfirmDialog from './ConfirmDialog';
import { handleAuthRedirect, signInWithGoogle, signOut, getStoredAuth, GoogleUser } from '@/lib/google-auth';
import { pushToGoogleDrive, pullFromGoogleDrive, hasUnsavedChanges, getSyncStatus } from '@/lib/sync';
import { getDailyQuote, fetchDailyQuote, Quote } from '@/lib/quotes';
import { useRecurrenceCheck } from '@/lib/hooks';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  useRecurrenceCheck();
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [quote, setQuote] = useState<Quote>(getDailyQuote());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showPullConfirm, setShowPullConfirm] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        // Check for OAuth callback data (from popup or redirect fallback)
        const redirectUser = await handleAuthRedirect();
        if (redirectUser) {
          setUser(redirectUser);
        } else {
          const storedUser = getStoredAuth();
          setUser(storedUser);
        }
        const status = await getSyncStatus();
        setLastSynced(status.lastSyncedAt);
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

  const handlePush = async () => {
    setPushing(true);
    setStatusMessage(null);
    try {
      const result = await pushToGoogleDrive();
      setStatusMessage(result.message);
      if (result.lastSyncedAt) {
        setLastSynced(result.lastSyncedAt);
      }
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      setStatusMessage('Push failed');
    } finally {
      setPushing(false);
    }
  };

  const executePull = useCallback(async () => {
    setPulling(true);
    setStatusMessage(null);
    try {
      const result = await pullFromGoogleDrive();
      setStatusMessage(result.message);
      if (result.lastSyncedAt) {
        setLastSynced(result.lastSyncedAt);
      }
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      setStatusMessage('Pull failed');
    } finally {
      setPulling(false);
    }
  }, []);

  const handlePull = async () => {
    try {
      const unsaved = await hasUnsavedChanges();
      if (unsaved) {
        setShowPullConfirm(true);
        return;
      }
    } catch {
      // If check fails, proceed anyway
    }
    executePull();
  };

  const handleSignIn = async () => {
    try {
      const googleUser = await signInWithGoogle();
      setUser(googleUser);
    } catch (error) {
      console.error('Sign in failed:', error);
      setStatusMessage('Sign in failed');
      setTimeout(() => setStatusMessage(null), 3000);
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

  const isBusy = pushing || pulling;

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
                onClick={handlePull}
                disabled={isBusy}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
              >
                {pulling ? 'Pulling...' : 'Pull'}
              </button>
              <button
                onClick={handlePush}
                disabled={isBusy}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-sm"
              >
                {pushing ? 'Pushing...' : 'Push'}
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
              onClick={handleSignIn}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              Sign in with Google
            </button>
          )}
          {statusMessage && (
            <span className={`text-sm ${statusMessage.includes('failed') || statusMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
              {statusMessage}
            </span>
          )}
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>

      <ConfirmDialog
        isOpen={showPullConfirm}
        onClose={() => setShowPullConfirm(false)}
        onConfirm={executePull}
        title="Pull from Google Drive"
        message="Pull will replace all local data. You have changes that haven't been pushed. Continue?"
        confirmLabel="Pull"
        variant="warning"
      />
    </div>
  );
}
