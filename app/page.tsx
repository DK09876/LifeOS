'use client';

import { useEffect, useState } from 'react';
import TaskCard from '@/components/TaskCard';
import DomainCard from '@/components/DomainCard';
import { Task, Domain } from '@/types/notion';

type View = 'all' | 'today' | 'week';

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [tasksRes, domainsRes] = await Promise.all([
        fetch('/api/data/tasks').then(r => r.json()),
        fetch('/api/data/domains').then(r => r.json()),
      ]);

      setTasks(tasksRes);
      setDomains(domainsRes);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkDone(taskId: string) {
    try {
      await fetch('/api/tasks/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      await fetchData();
    } catch (error) {
      console.error('Error marking task as done:', error);
    }
  }

  async function handleUndo(taskId: string) {
    try {
      await fetch('/api/tasks/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      await fetchData();
    } catch (error) {
      console.error('Error undoing task:', error);
    }
  }

  async function handleReset(taskId: string) {
    try {
      await fetch('/api/tasks/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      await fetchData();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your LifeOS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">👾</span>
            <h1 className="text-4xl font-bold text-gray-900">Life OS</h1>
          </div>
          <p className="text-gray-600">Your personal productivity system powered by Notion</p>
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
        <div className="bg-white rounded-lg shadow-sm p-2 mb-6 inline-flex gap-2">
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
            ☀️ Today
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'week'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📅 This Week
          </button>
        </div>

        {/* Status Filter */}
        <div className="bg-white rounded-lg shadow-sm p-2 mb-6 inline-flex gap-2 ml-4">
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

        <button
          onClick={fetchData}
          className="ml-4 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          🔄 Refresh
        </button>

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
            <div className="space-y-4">
              {domains.map(domain => (
                <DomainCard key={domain.id} domain={domain} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
