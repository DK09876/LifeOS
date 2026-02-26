'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Sidebar from './Sidebar';
import ConfirmDialog from './ConfirmDialog';
import { ToastProvider, useToast } from './Toast';
import { handleAuthRedirect, signInWithGoogle, signOut, getStoredAuth, GoogleUser } from '@/lib/google-auth';
import { pushToGoogleDrive, pullFromGoogleDrive, hasUnsavedChanges, getSyncStatus } from '@/lib/sync';
import { getDailyQuote, fetchDailyQuote, Quote } from '@/lib/quotes';
import { useRecurrenceCheck } from '@/lib/hooks';

interface AppLayoutProps {
  children: React.ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  useRecurrenceCheck();
  const { showToast } = useToast();
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [quote, setQuote] = useState<Quote>(getDailyQuote());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
    try {
      const result = await pushToGoogleDrive();
      if (!result.success && result.message.includes('Not signed in')) {
        setUser(null);
        showToast('Session expired — please sign in again', 'error');
      } else {
        showToast(result.message, result.success ? 'success' : 'error');
      }
      if (result.lastSyncedAt) {
        setLastSynced(result.lastSyncedAt);
      }
    } catch {
      showToast('Push failed', 'error');
    } finally {
      setPushing(false);
    }
  };

  const executePull = useCallback(async () => {
    setPulling(true);
    try {
      const result = await pullFromGoogleDrive();
      if (!result.success && result.message.includes('Not signed in')) {
        setUser(null);
        showToast('Session expired — please sign in again', 'error');
      } else {
        showToast(result.message, result.success ? 'success' : 'error');
      }
      if (result.lastSyncedAt) {
        setLastSynced(result.lastSyncedAt);
      }
    } catch {
      showToast('Pull failed', 'error');
    } finally {
      setPulling(false);
    }
  }, [showToast]);

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
      showToast('Signed in successfully', 'success');
    } catch (error) {
      console.error('Sign in failed:', error);
      showToast('Sign in failed', 'error');
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
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative z-50">
            <Sidebar collapsed={false} onToggleCollapse={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className={`${sidebarCollapsed ? 'md:ml-14' : 'md:ml-56'} transition-all duration-200`}>
        {/* Top bar */}
        <header className="h-14 border-b border-[var(--border-color)] flex items-center px-4 md:px-6 gap-2 md:gap-4 sticky top-0 bg-[var(--background)] z-10">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-2 text-[var(--muted)] hover:text-white"
            aria-label="Open navigation menu"
          >
            ☰
          </button>

          {/* Quote */}
          <div className="flex-1 min-w-0 hidden sm:block">
            <p className="text-sm text-[var(--muted)] italic truncate">
              &ldquo;{quote.text}&rdquo; — {quote.author}
            </p>
          </div>
          {user ? (
            <>
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                {user.picture && (
                  <Image src={user.picture} alt={user.name} width={24} height={24} className="rounded-full" />
                )}
                <span className="hidden lg:inline">{user.email}</span>
              </div>
              {lastSynced && (
                <span className="text-xs text-[var(--muted)] hidden lg:inline">
                  Synced: {new Date(lastSynced).toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={handlePull}
                disabled={isBusy}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
                aria-label="Pull data from Google Drive"
              >
                {pulling ? 'Pulling...' : 'Pull'}
              </button>
              <button
                onClick={handlePush}
                disabled={isBusy}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-sm"
                aria-label="Push data to Google Drive"
              >
                {pushing ? 'Pushing...' : 'Push'}
              </button>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 text-[var(--muted)] hover:text-white text-sm hidden sm:inline"
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
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6">
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

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ToastProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </ToastProvider>
  );
}
