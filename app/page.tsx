'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import TaskCard from '@/components/TaskCard';
import DomainCard from '@/components/DomainCard';
import { useTasks, useDomains, markTaskDone, undoTaskDone, resetTask } from '@/lib/hooks';
import { initGoogleAuth, signInWithGoogle, signOut, getStoredAuth, GoogleUser } from '@/lib/google-auth';
import { syncWithGoogleDrive, getSyncStatus } from '@/lib/sync';

type View = 'all' | 'today' | 'week';

export default function Home() {
  const tasks = useTasks();
  const domains = useDomains();
  const [view, setView] = useState<View>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  const syncRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncWithGoogleDrive();
      setSyncMessage(result.message);
      if (result.lastSyncedAt) {
        setLastSynced(result.lastSyncedAt);
      }
      // Clear message after 3 seconds
      setTimeout(() => setSyncMessage(null), 3000);
    } catch {
      setSyncMessage('Sync failed');
    } finally {
      setSyncing(false);
    }
  }, []);

  // Keep ref updated with latest handleSync
  syncRef.current = handleSync;

  // Initialize Google Auth and check sync status
  useEffect(() => {
    async function init() {
      try {
        await initGoogleAuth();
        const storedUser = getStoredAuth();
        setUser(storedUser);

        const status = await getSyncStatus();
        setLastSynced(status.lastSyncedAt);

        // Auto-sync on startup if signed in
        if (storedUser) {
          syncRef.current?.();
        }
      } catch (err) {
        console.error('Failed to initialize:', err);
      } finally {
        setAuthInitialized(true);
      }
    }
    init();
  }, []);

  const handleSignIn = async () => {
    try {
      const googleUser = await signInWithGoogle();
      setUser(googleUser);
      // Sync after signing in
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

  async function handleMarkDone(taskId: string) {
    try {
      await markTaskDone(taskId);
    } catch (error) {
      console.error('Error marking task as done:', error);
    }
  }

  async function handleUndo(taskId: string) {
    try {
      await undoTaskDone(taskId);
    } catch (error) {
      console.error('Error undoing task:', error);
    }
  }

  async function handleReset(taskId: string) {
    try {
      await resetTask(taskId);
    } catch (error) {
      console.error('Error resetting task:', error);
    }
  }

  const filterTasks = () => {
    let filtered = tasks;

    // Filter by status
    if (filterStatus === 'active') {
      filtered = filtered.filter(t => t.status !== 'Done' && t.status !== 'Archived');
    } else if (filterStatus === 'done') {
      filtered = filtered.filter(t => t.status === 'Done');
    } else if (filterStatus === 'archived') {
      filtered = filtered.filter(t => t.status === 'Archived');
    }

    // Filter by view
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    if (view === 'today') {
      filtered = filtered.filter(t => {
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === today.getTime();
      });
    } else if (view === 'week') {
      filtered = filtered.filter(t => {
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        return dueDate >= today && dueDate <= nextWeek;
      });
    }

    return filtered;
  };

  const filteredTasks = filterTasks();
  const tasksNeedingReset = tasks.filter(t => t.needsReset);

  // Show loading only before auth is initialized
  if (!authInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading LifeOS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">👾</span>
              <h1 className="text-4xl font-bold text-gray-900">LifeOS</h1>
            </div>
            <p className="text-gray-600">Your personal productivity system</p>
          </div>

          {/* Auth & Sync Section */}
          <div className="text-right">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    {user.picture && (
                      <Image
                        src={user.picture}
                        alt={user.name}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    )}
                    <span>{user.email}</span>
                  </div>
                  {lastSynced && (
                    <div className="text-xs text-gray-500 mt-1">
                      Last synced: {new Date(lastSynced).toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {syncing ? 'Syncing...' : 'Sync'}
                </button>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>
            )}
            {syncMessage && (
              <div className={`mt-2 text-sm ${syncMessage.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
                {syncMessage}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-indigo-600">{tasks.length}</div>
            <div className="text-sm text-gray-600">Total Tasks</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {tasks.filter(t => t.status === 'Done').length}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-orange-600">
              {tasksNeedingReset.length}
            </div>
            <div className="text-sm text-gray-600">Need Reset</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-purple-600">{domains.length}</div>
            <div className="text-sm text-gray-600">Domains</div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-2 inline-flex gap-2">
            <button
              onClick={() => setView('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Tasks
            </button>
            <button
              onClick={() => setView('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === 'today'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === 'week'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              This Week
            </button>
          </div>

          {/* Status Filter */}
          <div className="bg-white rounded-lg shadow-sm p-2 inline-flex gap-2">
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'active'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus('done')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'done'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Done
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* No data message */}
        {tasks.length === 0 && domains.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Welcome to LifeOS!</h3>
            <p className="text-gray-600 mb-4">
              {user
                ? 'Your data will sync from Google Drive, or you can start fresh by adding tasks and domains.'
                : 'Sign in with Google to sync your data across devices, or start using the app locally.'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tasks Section */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Tasks ({filteredTasks.length})
            </h2>
            {filteredTasks.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <p className="text-gray-500">No tasks found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onMarkDone={handleMarkDone}
                    onUndo={handleUndo}
                    onReset={handleReset}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Domains Section */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Domains ({domains.length})
            </h2>
            {domains.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <p className="text-gray-500">No domains yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {domains.map(domain => (
                  <DomainCard key={domain.id} domain={domain} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
