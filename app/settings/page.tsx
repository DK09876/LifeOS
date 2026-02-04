'use client';

import { useState, useEffect } from 'react';
import { useFilterPresets, useDomains, createFilterPreset, updateFilterPreset, deleteFilterPreset, toggleFilterPresetVisibility } from '@/lib/hooks';
import { FilterPreset } from '@/lib/db';

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
  { value: 'all', label: 'All Priorities' },
  { value: '1 - Urgent', label: 'Urgent' },
  { value: '2 - High', label: 'High' },
  { value: '3 - Normal', label: 'Normal' },
  { value: '4 - Low', label: 'Low' },
  { value: '5 - Optional', label: 'Optional' },
];

const ACTION_POINTS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low (1-2)' },
  { value: 'med', label: 'Medium (3-4)' },
  { value: 'high', label: 'High (5)' },
];

const RECURRENCE_OPTIONS = [
  { value: 'all', label: 'All' },
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
  const [newPresetPriority, setNewPresetPriority] = useState('all');
  const [newPresetActionPoints, setNewPresetActionPoints] = useState('all');
  const [newPresetDomain, setNewPresetDomain] = useState('all');
  const [newPresetRecurrence, setNewPresetRecurrence] = useState('all');

  useEffect(() => {
    setHideGetStarted(localStorage.getItem('hideGetStarted') === 'true');
  }, []);

  const handleToggle = () => {
    const next = !hideGetStarted;
    setHideGetStarted(next);
    localStorage.setItem('hideGetStarted', String(next));
    window.dispatchEvent(new Event('storage'));
  };

  const handleTogglePresetVisibility = async (presetId: string) => {
    await toggleFilterPresetVisibility(presetId);
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
    setNewPresetPriority('all');
    setNewPresetActionPoints('all');
    setNewPresetDomain('all');
    setNewPresetRecurrence('all');
    setIsAddingPreset(false);
  };

  const handleEditPreset = (preset: FilterPreset) => {
    setEditingPreset(preset);
    setNewPresetName(preset.name);
    setNewPresetColor(preset.color);
    setNewPresetPriority(preset.filters.priority || 'all');
    setNewPresetActionPoints(preset.filters.actionPoints || 'all');
    setNewPresetDomain(preset.filters.domain || 'all');
    setNewPresetRecurrence(preset.filters.recurrence || 'all');
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
    setNewPresetPriority('all');
    setNewPresetActionPoints('all');
    setNewPresetDomain('all');
    setNewPresetRecurrence('all');
  };

  const handleDeletePreset = async (presetId: string) => {
    await deleteFilterPreset(presetId);
  };

  const cancelEdit = () => {
    setEditingPreset(null);
    setIsAddingPreset(false);
    setNewPresetName('');
    setNewPresetColor('blue');
    setNewPresetPriority('all');
    setNewPresetActionPoints('all');
    setNewPresetDomain('all');
    setNewPresetRecurrence('all');
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
                    if (preset.filters.priority && preset.filters.priority !== 'all') {
                      parts.push(`Priority: ${preset.filters.priority.split(' - ')[1] || preset.filters.priority}`);
                    }
                    if (preset.filters.actionPoints && preset.filters.actionPoints !== 'all') {
                      parts.push(`AP: ${preset.filters.actionPoints}`);
                    }
                    if (preset.filters.domain && preset.filters.domain !== 'all') {
                      const domain = domains.find(d => d.id === preset.filters.domain);
                      parts.push(`Domain: ${domain?.name || preset.filters.domain}`);
                    }
                    if (preset.filters.recurrence && preset.filters.recurrence !== 'all') {
                      parts.push(`Recurrence: ${preset.filters.recurrence === 'None' ? 'One-time' : 'Recurring'}`);
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
                  <label className="block text-sm text-[var(--muted)] mb-1">Priority</label>
                  <select
                    value={newPresetPriority}
                    onChange={(e) => setNewPresetPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PRIORITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Action Points</label>
                  <select
                    value={newPresetActionPoints}
                    onChange={(e) => setNewPresetActionPoints(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ACTION_POINTS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Domain</label>
                  <select
                    value={newPresetDomain}
                    onChange={(e) => setNewPresetDomain(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Domains</option>
                    {domains.map(d => (
                      <option key={d.id} value={d.id}>{d.icon || '📁'} {d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Recurrence</label>
                  <select
                    value={newPresetRecurrence}
                    onChange={(e) => setNewPresetRecurrence(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {RECURRENCE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
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
    </div>
  );
}
