'use client';

import { useState } from 'react';
import { Habit } from '@/types';

interface HabitFormProps {
  habit?: Habit | null;
  onSubmit: (data: HabitFormData) => void;
  onCancel: () => void;
}

export interface HabitFormData {
  habitName: string;
  recurrence: Habit['recurrence'];
  targetPerWeek: number | null;
  notes: string;
  icon: string | null;
  isActive: boolean;
}

const RECURRENCE_OPTIONS: Habit['recurrence'][] = [
  'Daily',
  'Weekly',
  'Biweekly',
  'Monthly',
  'Bimonthly',
  'Quarterly',
  'Half-Yearly',
  'Yearly',
];

// Common emoji suggestions for habits
const EMOJI_SUGGESTIONS = [
  '💪', '🏃', '📚', '💧', '🧘', '💤', '🍎', '💊',
  '🎯', '✍️', '🧹', '📱', '🎸', '🌱', '🙏', '🧠',
  '☀️', '🌙', '💰', '🎨', '🚿', '🦷', '📝', '🏋️',
];

const inputClass = "w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelClass = "block text-sm font-medium text-[var(--muted)] mb-1";

function getInitialFormData(habit?: Habit | null): HabitFormData {
  if (habit) {
    return {
      habitName: habit.habitName,
      recurrence: habit.recurrence,
      targetPerWeek: habit.targetPerWeek,
      notes: habit.notes,
      icon: habit.icon,
      isActive: habit.isActive,
    };
  }
  return {
    habitName: '',
    recurrence: 'Daily',
    targetPerWeek: null,
    notes: '',
    icon: null,
    isActive: true,
  };
}

export default function HabitForm({ habit, onSubmit, onCancel }: HabitFormProps) {
  const [formData, setFormData] = useState<HabitFormData>(() => getInitialFormData(habit));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.habitName.trim()) return;
    onSubmit(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : (value === '' ? null : value),
    }));
  };

  const selectEmoji = (emoji: string) => {
    setFormData((prev) => ({
      ...prev,
      icon: emoji,
    }));
  };

  const clearEmoji = () => {
    setFormData((prev) => ({
      ...prev,
      icon: null,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Habit Name */}
      <div>
        <label htmlFor="habitName" className={labelClass}>
          Habit Name *
        </label>
        <input
          type="text"
          id="habitName"
          name="habitName"
          value={formData.habitName}
          onChange={handleChange}
          required
          className={inputClass}
          placeholder="e.g., Morning Exercise, Read 30 mins"
        />
      </div>

      {/* Icon/Emoji */}
      <div>
        <label className={labelClass}>
          Icon (Emoji)
        </label>
        <div className="space-y-3">
          {/* Current selection and custom input */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center text-2xl border-2 border-dashed border-[var(--border-color)] rounded-lg bg-[var(--background)]">
              {formData.icon || '?'}
            </div>
            <input
              type="text"
              name="icon"
              value={formData.icon || ''}
              onChange={handleChange}
              maxLength={2}
              className="w-20 px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-center text-lg text-[var(--foreground)]"
              placeholder="Emoji"
            />
            {formData.icon && (
              <button
                type="button"
                onClick={clearEmoji}
                className="px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)] rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Emoji suggestions */}
          <div className="flex flex-wrap gap-2">
            {EMOJI_SUGGESTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => selectEmoji(emoji)}
                className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg border-2 transition-all hover:scale-110 ${
                  formData.icon === emoji
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-[var(--border-color)] hover:border-[var(--muted)]'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Frequency Type Toggle */}
      <div>
        <label className={labelClass}>Frequency</label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, targetPerWeek: null }))}
            className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
              formData.targetPerWeek === null
                ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                : 'border-[var(--border-color)] text-[var(--muted)] hover:border-[var(--muted)]'
            }`}
          >
            Fixed Schedule
          </button>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, targetPerWeek: 3 }))}
            className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
              formData.targetPerWeek !== null
                ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                : 'border-[var(--border-color)] text-[var(--muted)] hover:border-[var(--muted)]'
            }`}
          >
            X Times Per Week
          </button>
        </div>

        {formData.targetPerWeek === null ? (
          // Fixed schedule recurrence dropdown
          <select
            id="recurrence"
            name="recurrence"
            value={formData.recurrence}
            onChange={handleChange}
            className={inputClass}
          >
            {RECURRENCE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          // Times per week input
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="1"
              max="7"
              value={formData.targetPerWeek}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                targetPerWeek: Math.min(7, Math.max(1, parseInt(e.target.value) || 1))
              }))}
              className="w-20 px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-center text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-[var(--muted)]">times per week (any days)</span>
          </div>
        )}
        <p className="text-xs text-[var(--muted)] mt-2">
          {formData.targetPerWeek === null
            ? 'Habit will be due on a fixed schedule (e.g., every day, every week)'
            : 'Habit will appear daily until you complete it the target number of times each week'}
        </p>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className={inputClass}
          placeholder="Optional notes about this habit..."
        />
      </div>

      {/* Active toggle (only shown when editing) */}
      {habit && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            checked={formData.isActive}
            onChange={handleChange}
            className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--background)] text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="isActive" className="text-sm text-[var(--foreground)]">
            Active (uncheck to pause this habit)
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border-color)]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-[var(--muted)] bg-[var(--card-hover)] hover:bg-[var(--border-color)] rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          {habit ? 'Update Habit' : 'Create Habit'}
        </button>
      </div>
    </form>
  );
}
