'use client';

import { useState, useEffect } from 'react';
import { Domain } from '@/types';

interface DomainFormProps {
  domain?: Domain | null;
  onSubmit: (data: DomainFormData) => void | Promise<void>;
  onCancel: () => void;
}

export interface DomainFormData {
  name: string;
  icon: string | null;
  priority: Domain['priority'];
}

const PRIORITY_OPTIONS: Domain['priority'][] = ['1 - Critical', '2 - Important', '3 - Maintenance'];

// Common emoji suggestions for domains
const EMOJI_SUGGESTIONS = [
  '💼', '🏠', '💪', '📚', '💰', '🎯', '🧘', '👨‍👩‍👧‍👦',
  '🎨', '🔧', '📱', '🌱', '🎮', '✈️', '🍳', '🏃',
  '💡', '🎵', '📊', '🛒', '🏥', '🎓', '🚗', '🐕',
];

const inputClass = "w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelClass = "block text-sm font-medium text-[var(--muted)] mb-1";

export default function DomainForm({ domain, onSubmit, onCancel }: DomainFormProps) {
  const [formData, setFormData] = useState<DomainFormData>({
    name: '',
    icon: null,
    priority: '3 - Maintenance',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (domain) {
      setFormData({
        name: domain.name,
        icon: domain.icon,
        priority: domain.priority,
      });
    }
  }, [domain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      console.error('Form submission failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? null : value,
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
      {/* Domain Name */}
      <div>
        <label htmlFor="name" className={labelClass}>
          Domain Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className={inputClass}
          placeholder="e.g., Work, Health, Personal"
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

      {/* Priority */}
      <div>
        <label htmlFor="priority" className={labelClass}>
          Priority
        </label>
        <select
          id="priority"
          name="priority"
          value={formData.priority}
          onChange={handleChange}
          className={inputClass}
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

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
          disabled={submitting}
          className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {submitting ? 'Saving...' : (domain ? 'Update Domain' : 'Create Domain')}
        </button>
      </div>
    </form>
  );
}
