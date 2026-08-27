'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { ToastProvider, useToast } from './Toast';
import { getDailyQuote, fetchDailyQuote, Quote } from '@/lib/quotes';
import { useRecurrenceCheck } from '@/lib/hooks';
import { ProfileGate } from './ProfileGate';
import { ProfileSwitcher } from './ProfileSwitcher';

interface AppLayoutProps {
  children: React.ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  useRecurrenceCheck();
  const { showToast } = useToast();
  const [initialized, setInitialized] = useState(false);
  const [quote, setQuote] = useState<Quote>(getDailyQuote());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    async function init() {
      try {
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
          <ProfileSwitcher />
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>

    </div>
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ProfileGate>
    <ToastProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </ToastProvider>
    </ProfileGate>
  );
}
