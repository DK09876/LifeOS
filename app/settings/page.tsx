'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useFilterPresets, useDomains, createFilterPreset, updateFilterPreset, deleteFilterPreset, toggleFilterPresetVisibility, runRecurrenceCheck, getRecurrenceCheckStatus } from '@/lib/hooks';
import { FilterPreset } from '@/lib/db';
import { pushToGoogleDrive, pullFromGoogleDrive, hasUnsavedChanges, getSyncStatus } from '@/lib/sync';
import { getStoredAuth } from '@/lib/google-auth';

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue', bg: 'bg-blue-600', hover: 'hover:bg-blue-700' },
  { value: 'red', label: 'Red', bg: 'bg-red-600', hover: 'hover:bg-red-700' },
  { value: 'green', label: 'Green', bg: 'bg-green-600', hover: 'hover:bg-green-700' },
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-600', hover: 'hover:bg-yellow-700' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-600', hover: 'hover:bg-purple-700' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-600', hover: 'hover:bg-orange-700' },
  { value: 'pink', label: 'Pink', bg: 'bg-pink-600', hover: 'hover:bg-pink-700' },
  { value: 'gray', label: 'Gray', bg: 'bg-gray-600', hover: 'hover:bg-gray-700' },
];

const PRIORITY_OPTIONS = [
  { value: '1 - Urgent', label: 'Urgent' },
  { value: '2 - High', label: 'High' },
  { value: '3 - Normal', label: 'Normal' },
  { value: '4 - Low', label: 'Low' },
  { value: '5 - Optional', label: 'Optional' },
];

const ACTION_POINTS_OPTIONS = [
  { value: 'low', label: 'Low (1-2)' },
  { value: 'med', label: 'Medium (3-4)' },
  { value: 'high', label: 'High (5)' },
];

const RECURRENCE_OPTIONS = [
  { value: 'None', label: 'One-time only' },
  { value: 'recurring', label: 'Recurring only' },
];

export default function SettingsPage() {
  const [hideGetStarted, setHideGetStarted] = useState(false);
  const filterPresets = useFilterPresets();
  const domains = useDomains();
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [editingPreset, setEditingPreset] = useState<FilterPreset | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetColor, setNewPresetColor] = useState('blue');
  const [newPresetPriority, setNewPresetPriority] = useState<string[]>([]);
  const [newPresetActionPoints, setNewPresetActionPoints] = useState<string[]>([]);
  const [newPresetDomain, setNewPresetDomain] = useState<string[]>([]);
  const [newPresetRecurrence, setNewPresetRecurrence] = useState<string[]>([]);

  // Automations state
  const [recurrenceLastRun, setRecurrenceLastRun] = useState<string | null>(null);
  const [recurrenceRunning, setRecurrenceRunning] = useState(false);
  const [recurrenceResult, setRecurrenceResult] = useState<string | null>(null);
  const [syncLastRun, setSyncLastRun] = useState<string | null>(null);
  const [pushRunning, setPushRunning] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const [pullRunning, setPullRunning] = useState(false);
  const [pullResult, setPullResult] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showPullConfirm, setShowPullConfirm] = useState(false);

  useEffect(() => {
    setHideGetStarted(localStorage.getItem('hideGetStarted') === 'true');

    // Load automation statuses
    async function loadStatuses() {
      const recurrenceStatus = await getRecurrenceCheckStatus();
      setRecurrenceLastRun(recurrenceStatus.lastRun);

      const syncStatus = await getSyncStatus();
      setSyncLastRun(syncStatus.lastSyncedAt);

      const user = getStoredAuth();
      setIsSignedIn(!!user);
    }
    loadStatuses();
  }, []);

  const handleToggle = () => {
    const next = !hideGetStarted;
    setHideGetStarted(next);
    localStorage.setItem('hideGetStarted', String(next));
    window.dispatchEvent(new Event('storage'));
  };

  const handleRunRecurrenceCheck = async () => {
    setRecurrenceRunning(true);
    setRecurrenceResult(null);
    try {
      const result = await runRecurrenceCheck();
      setRecurrenceLastRun(new Date().toISOString().slice(0, 10));
      if (result.tasksReset > 0) {
        setRecurrenceResult(`Reset ${result.tasksReset} recurring task${result.tasksReset > 1 ? 's' : ''}`);
      } else {
        setRecurrenceResult('No tasks needed reset');
      }
    } catch (err) {
      setRecurrenceResult('Failed to run check');
    } finally {
      setRecurrenceRunning(false);
      setTimeout(() => setRecurrenceResult(null), 3000);
    }
  };

  const handlePushToDrive = async () => {
    setPushRunning(true);
    setPushResult(null);
    try {
      const result = await pushToGoogleDrive();
      if (result.lastSyncedAt) {
        setSyncLastRun(result.lastSyncedAt);
      }
      setPushResult(result.message);
    } catch (err) {
      setPushResult('Push failed');
    } finally {
      setPushRunning(false);
      setTimeout(() => setPushResult(null), 3000);
    }
  };

  const executePull = useCallback(async () => {
    setPullRunning(true);
    setPullResult(null);
    try {
      const result = await pullFromGoogleDrive();
      if (result.lastSyncedAt) {
        setSyncLastRun(result.lastSyncedAt);
      }
      setPullResult(result.message);
    } catch {
      setPullResult('Pull failed');
    } finally {
      setPullRunning(false);
      setTimeout(() => setPullResult(null), 3000);
    }
  }, []);

  const handlePullFromDrive = async () => {
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

  const formatLastRun = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    // Handle both date-only (YYYY-MM-DD) and full ISO timestamps
    if (dateStr.length === 10) {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString();
    }
    return new Date(dateStr).toLocaleString();
  };

  const handleTogglePresetVisibility = async (presetId: string) => {
    await toggleFilterPresetVisibility(presetId);
  };

  const toArray = (v: string | string[] | undefined): string[] => {
    if (Array.isArray(v)) return v;
    if (!v || v === 'all') return [];
    return [v];
  };

  const toggleArrayValue = (arr: string[], value: string): string[] => {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
  };

  const handleAddPreset = async () => {
    if (!newPresetName.trim()) return;

    await createFilterPreset({
      name: newPresetName.trim(),
      color: newPresetColor,
      filters: {
        priority: newPresetPriority,
        actionPoints: newPresetActionPoints,
        domain: newPresetDomain,
        recurrence: newPresetRecurrence,
      },
      visible: true,
    });

    setNewPresetName('');
    setNewPresetColor('blue');
    setNewPresetPriority([]);
    setNewPresetActionPoints([]);
    setNewPresetDomain([]);
    setNewPresetRecurrence([]);
    setIsAddingPreset(false);
  };

  const handleEditPreset = (preset: FilterPreset) => {
    setEditingPreset(preset);
    setNewPresetName(preset.name);
    setNewPresetColor(preset.color);
    setNewPresetPriority(toArray(preset.filters.priority));
    setNewPresetActionPoints(toArray(preset.filters.actionPoints));
    setNewPresetDomain(toArray(preset.filters.domain));
    setNewPresetRecurrence(toArray(preset.filters.recurrence));
  };

  const handleUpdatePreset = async () => {
    if (!editingPreset || !newPresetName.trim()) return;

    await updateFilterPreset(editingPreset.id, {
      name: newPresetName.trim(),
      color: newPresetColor,
      filters: {
        priority: newPresetPriority,
        actionPoints: newPresetActionPoints,
        domain: newPresetDomain,
        recurrence: newPresetRecurrence,
      },
    });

    setEditingPreset(null);
    setNewPresetName('');
    setNewPresetColor('blue');
    setNewPresetPriority([]);
    setNewPresetActionPoints([]);
    setNewPresetDomain([]);
    setNewPresetRecurrence([]);
  };

  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);

  const handleDeletePreset = (presetId: string) => {
    setPresetToDelete(presetId);
  };

  const handleConfirmDeletePreset = async () => {
    if (presetToDelete) {
      await deleteFilterPreset(presetToDelete);
      setPresetToDelete(null);
    }
  };

  const cancelEdit = () => {
    setEditingPreset(null);
    setIsAddingPreset(false);
    setNewPresetName('');
    setNewPresetColor('blue');
    setNewPresetPriority([]);
    setNewPresetActionPoints([]);
    setNewPresetDomain([]);
    setNewPresetRecurrence([]);
  };

  const getColorClasses = (color: string) => {
    const option = COLOR_OPTIONS.find(c => c.value === color);
    return option ? `${option.bg}` : 'bg-blue-600';
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Settings</h1>
        <p className="text-[var(--muted)]">Configure LifeOS preferences</p>
      </div>

      {/* General Settings */}
      <div className="bg-[var(--card-bg)] rounded-lg p-5 mb-6">
        <h2 className="text-lg font-medium text-white mb-4">General</h2>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-white font-medium">Hide "Get Started" page</p>
            <p className="text-sm text-[var(--muted)]">Remove the Get Started link from the sidebar</p>
          </div>
          <input
            type="checkbox"
            checked={hideGetStarted}
            onChange={handleToggle}
            className="w-5 h-5 rounded border-[var(--border-color)] bg-[var(--background)] text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </label>
      </div>

      {/* Automations */}
      <div className="bg-[var(--card-bg)] rounded-lg p-5 mb-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-white">Automations</h2>
          <p className="text-sm text-[var(--muted)]">Background tasks that run automatically on app load</p>
        </div>

        <div className="space-y-4">
          {/* Recurring Tasks Reset */}
          <div className="flex items-center justify-between p-4 bg-[var(--background)] rounded-lg">
            <div className="flex-1">
              <p className="text-white font-medium">Reset Recurring Tasks</p>
              <p className="text-sm text-[var(--muted)]">
                Resets completed recurring tasks (daily, weekly, etc.) back to your backlog when their interval has passed.
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">
                Last run: {formatLastRun(recurrenceLastRun)}
              </p>
              {recurrenceResult && (
                <p className="text-xs text-green-400 mt-1">{recurrenceResult}</p>
              )}
            </div>
            <button
              onClick={handleRunRecurrenceCheck}
              disabled={recurrenceRunning}
              className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {recurrenceRunning ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Running...
                </>
              ) : (
                'Run Now'
              )}
            </button>
          </div>

          {/* Push to Google Drive */}
          <div className="flex items-center justify-between p-4 bg-[var(--background)] rounded-lg">
            <div className="flex-1">
              <p className="text-white font-medium">Push to Google Drive</p>
              <p className="text-sm text-[var(--muted)]">
                Upload local data to Google Drive, replacing the remote backup.
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">
                Last synced: {formatLastRun(syncLastRun)}
              </p>
              {pushResult && (
                <p className={`text-xs mt-1 ${pushResult.includes('failed') || pushResult.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                  {pushResult}
                </p>
              )}
              {!isSignedIn && (
                <p className="text-xs text-yellow-400 mt-1">Sign in with Google to enable push</p>
              )}
            </div>
            <button
              onClick={handlePushToDrive}
              disabled={pushRunning || pullRunning || !isSignedIn}
              className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {pushRunning ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Pushing...
                </>
              ) : (
                'Push Now'
              )}
            </button>
          </div>
          {/* Pull from Google Drive */}
          <div className="flex items-center justify-between p-4 bg-[var(--background)] rounded-lg">
            <div className="flex-1">
              <p className="text-white font-medium">Pull from Google Drive</p>
              <p className="text-sm text-[var(--muted)]">
                Overwrite local data with the latest backup from Google Drive. This replaces all local data.
              </p>
              {pullResult && (
                <p className={`text-xs mt-1 ${pullResult.includes('failed') || pullResult.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                  {pullResult}
                </p>
              )}
              {!isSignedIn && (
                <p className="text-xs text-yellow-400 mt-1">Sign in with Google to enable pull</p>
              )}
            </div>
            <button
              onClick={handlePullFromDrive}
              disabled={pullRunning || pushRunning || !isSignedIn}
              className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {pullRunning ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Pulling...
                </>
              ) : (
                'Pull Now'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Planning Mode Filter Presets */}
      <div className="bg-[var(--card-bg)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium text-white">Planning Mode Filter Presets</h2>
            <p className="text-sm text-[var(--muted)]">Quick filters shown in the planning view</p>
          </div>
          {!isAddingPreset && !editingPreset && (
            <button
              onClick={() => setIsAddingPreset(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
            >
              + Add Preset
            </button>
          )}
        </div>

        {/* Preset List */}
        <div className="space-y-2 mb-4">
          {filterPresets.map(preset => (
            <div
              key={preset.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                preset.visible ? 'bg-[var(--background)]' : 'bg-[var(--background)]/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={preset.visible}
                  onChange={() => handleTogglePresetVisibility(preset.id)}
                  className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--background)] text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className={`px-2 py-0.5 rounded text-xs text-white ${getColorClasses(preset.color)}`}>
                  {preset.name}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {(() => {
                    const parts: string[] = [];
                    const pArr = toArray(preset.filters.priority);
                    if (pArr.length > 0) {
                      parts.push(`Priority: ${pArr.map(v => v.split(' - ')[1] || v).join(', ')}`);
                    }
                    const apArr = toArray(preset.filters.actionPoints);
                    if (apArr.length > 0) {
                      parts.push(`AP: ${apArr.join(', ')}`);
                    }
                    const dArr = toArray(preset.filters.domain);
                    if (dArr.length > 0) {
                      parts.push(`Domain: ${dArr.map(id => domains.find(d => d.id === id)?.name || id).join(', ')}`);
                    }
                    const rArr = toArray(preset.filters.recurrence);
                    if (rArr.length > 0) {
                      parts.push(`Recurrence: ${rArr.map(v => v === 'None' ? 'One-time' : 'Recurring').join(', ')}`);
                    }
                    return parts.length > 0 ? parts.join(' | ') : 'No filters';
                  })()}
                </span>
                {preset.isDefault && (
                  <span className="text-xs text-[var(--muted)] bg-[var(--border-color)] px-1.5 py-0.5 rounded">
                    Default
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEditPreset(preset)}
                  className="text-[var(--muted)] hover:text-white text-sm"
                >
                  Edit
                </button>
                {!preset.isDefault && (
                  <button
                    onClick={() => handleDeletePreset(preset.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add/Edit Form */}
        {(isAddingPreset || editingPreset) && (
          <div className="p-4 bg-[var(--background)] rounded-lg">
            <h3 className="text-white font-medium mb-3">
              {editingPreset ? 'Edit Preset' : 'New Preset'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Name</label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="e.g., Quick Tasks"
                  className="w-full px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-white placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => setNewPresetColor(color.value)}
                      className={`w-8 h-8 rounded ${color.bg} ${
                        newPresetColor === color.value ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--background)]' : ''
                      }`}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Priority {newPresetPriority.length === 0 && <span className="text-[var(--muted)]/60">(all)</span>}</label>
                  <div className="space-y-1">
                    {PRIORITY_OPTIONS.map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-[var(--card-bg)]">
                        <input
                          type="checkbox"
                          checked={newPresetPriority.includes(opt.value)}
                          onChange={() => setNewPresetPriority(toggleArrayValue(newPresetPriority, opt.value))}
                          className="w-3.5 h-3.5 rounded border-[var(--border-color)] bg-[var(--background)] text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-white">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Action Points {newPresetActionPoints.length === 0 && <span className="text-[var(--muted)]/60">(all)</span>}</label>
                  <div className="space-y-1">
                    {ACTION_POINTS_OPTIONS.map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-[var(--card-bg)]">
                        <input
                          type="checkbox"
                          checked={newPresetActionPoints.includes(opt.value)}
                          onChange={() => setNewPresetActionPoints(toggleArrayValue(newPresetActionPoints, opt.value))}
                          className="w-3.5 h-3.5 rounded border-[var(--border-color)] bg-[var(--background)] text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-white">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Domain {newPresetDomain.length === 0 && <span className="text-[var(--muted)]/60">(all)</span>}</label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {domains.map(d => (
                      <label key={d.id} className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-[var(--card-bg)]">
                        <input
                          type="checkbox"
                          checked={newPresetDomain.includes(d.id)}
                          onChange={() => setNewPresetDomain(toggleArrayValue(newPresetDomain, d.id))}
                          className="w-3.5 h-3.5 rounded border-[var(--border-color)] bg-[var(--background)] text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-white">{d.icon || '📁'} {d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Recurrence {newPresetRecurrence.length === 0 && <span className="text-[var(--muted)]/60">(all)</span>}</label>
                  <div className="space-y-1">
                    {RECURRENCE_OPTIONS.map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-[var(--card-bg)]">
                        <input
                          type="checkbox"
                          checked={newPresetRecurrence.includes(opt.value)}
                          onChange={() => setNewPresetRecurrence(toggleArrayValue(newPresetRecurrence, opt.value))}
                          className="w-3.5 h-3.5 rounded border-[var(--border-color)] bg-[var(--background)] text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-white">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={cancelEdit}
                  className="px-3 py-1.5 text-[var(--muted)] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={editingPreset ? handleUpdatePreset : handleAddPreset}
                  disabled={!newPresetName.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingPreset ? 'Save' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}
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

      <ConfirmDialog
        isOpen={presetToDelete !== null}
        onClose={() => setPresetToDelete(null)}
        onConfirm={handleConfirmDeletePreset}
        title="Delete Preset"
        message="Are you sure you want to delete this filter preset?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
