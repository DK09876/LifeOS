'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import { BackupReminder } from './BackupReminder';
import { ToastProvider, useToast } from './Toast';
import { getDailyQuote, fetchDailyQuote, Quote } from '@/lib/quotes';
import { useRecurrenceCheck } from '@/lib/hooks';
import { ProfileGate } from './ProfileGate';
import { ProfileSwitcher } from './ProfileSwitcher';
import QuickAdd from './QuickAdd';
import NotificationBell from './NotificationBell';

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
  const pathname = usePathname();
  // Picking a page from the phone menu should put the menu away.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMobileSidebarOpen(false);
  }

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
      <BackupReminder />

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
        <header className="border-b border-[var(--border-color)] sticky top-0 bg-[var(--background)] z-20 pt-safe">
          <div className="h-14 flex items-center px-4 md:px-6 gap-2 md:gap-4">
            {/* Quote. On a phone it gets its own line below, rather than
                being squeezed out of the bar entirely. */}
            <div className="flex-1 min-w-0">
              <p className="hidden sm:block text-sm text-[var(--muted)] italic truncate">
                &ldquo;{quote.text}&rdquo; — {quote.author}
              </p>
              <p className="sm:hidden text-base font-semibold text-white">LifeOS</p>
            </div>
            <QuickAdd />
            <NotificationBell />
            <ProfileSwitcher />
          </div>
          {/* On a phone the quote only rides along on Today: two lines of
              header on every page is a lot of a small screen. */}
          <p className={`sm:hidden px-4 pb-2 -mt-1 text-xs text-[var(--muted)] italic line-clamp-2 ${pathname === '/' ? '' : 'hidden'}`}>
            &ldquo;{quote.text}&rdquo; — {quote.author}
          </p>
        </header>

        {/* Page content. Bottom padding clears the phone's tab bar. */}
        <main className="p-4 md:p-6 pb-28 md:pb-6">
          {children}
        </main>
      </div>

      <BottomNav onMore={() => setMobileSidebarOpen(true)} />
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
