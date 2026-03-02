'use client';

import { useState, useEffect } from 'react';
import { Event, Domain } from '@/types';
import { getTodayString } from '@/lib/dates';

interface EventFormProps {
  event?: Event | null;
  domains: Domain[];
  onSubmit: (data: EventFormData) => void | Promise<void>;
  onCancel: () => void;
}

export interface EventFormData {
  eventName: string;
  date: string;
  time: string | null;
  duration: number | null;
  actionPoints: string | null;
  recurrence: Event['recurrence'];
  notes: string;
  domainId: string | null;
}

const RECURRENCE_OPTIONS: Event['recurrence'][] = ['None', 'Daily', 'Weekly', 'Biweekly', 'Monthly', 'Bimonthly', 'Quarterly', 'Half-Yearly', 'Yearly'];

const inputClass = "w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelClass = "block text-sm font-medium text-[var(--muted)] mb-1";

export default function EventForm({ event, domains, onSubmit, onCancel }: EventFormProps) {
  const [formData, setFormData] = useState<EventFormData>({
    eventName: '',
    date: getTodayString(),
    time: null,
    duration: null,
    actionPoints: null,
    recurrence: 'None',
    notes: '',
    domainId: null,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (event) {
      setFormData({
        eventName: event.eventName,
        date: event.date,
        time: event.time,
        duration: event.duration,
        actionPoints: event.actionPoints,
        recurrence: event.recurrence,
        notes: event.notes,
        domainId: event.domainId,
      });
    }
  }, [event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.eventName.trim() || !formData.date || submitting) return;
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? null : value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Event Name */}
      <div>
        <label htmlFor="eventName" className={labelClass}>
          Event Name *
        </label>
        <input
          type="text"
          id="eventName"
          name="eventName"
          value={formData.eventName}
          onChange={handleChange}
          required
          className={inputClass}
          placeholder="Enter event name"
        />
      </div>

      {/* Date, Time, Duration */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="date" className={labelClass}>
            Date *
          </label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="time" className={labelClass}>
            Time
          </label>
          <input
            type="time"
            id="time"
            name="time"
            value={formData.time || ''}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="duration" className={labelClass}>
            Duration (min)
          </label>
          <input
            type="number"
            id="duration"
            name="duration"
            min="0"
            value={formData.duration ?? ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              duration: e.target.value === '' ? null : parseInt(e.target.value) || null,
            }))}
            className={inputClass}
            placeholder="Minutes"
          />
        </div>
      </div>

      {/* Domain */}
      <div>
        <label htmlFor="domainId" className={labelClass}>
          Domain
        </label>
        <select
          id="domainId"
          name="domainId"
          value={formData.domainId || ''}
          onChange={handleChange}
          className={inputClass}
        >
          <option value="">No domain</option>
          {domains.map((domain) => (
            <option key={domain.id} value={domain.id}>
              {domain.icon ? `${domain.icon} ` : ''}{domain.name}
            </option>
          ))}
        </select>
      </div>

      {/* Recurrence */}
      <div>
        <label htmlFor="recurrence" className={labelClass}>
          Recurrence
        </label>
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
      </div>

      {/* Action Points */}
      <div>
        <label className={labelClass}>
          Action Points
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((level) => {
            const selected = formData.actionPoints === String(level);
            const colors = [
              'bg-green-600 hover:bg-green-500',
              'bg-lime-600 hover:bg-lime-500',
              'bg-yellow-600 hover:bg-yellow-500',
              'bg-orange-600 hover:bg-orange-500',
              'bg-red-600 hover:bg-red-500',
            ];
            const labels = ['Low', '', '', '', 'High'];
            return (
              <button
                key={level}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    actionPoints: prev.actionPoints === String(level) ? null : String(level),
                  }))
                }
                className={`flex-1 py-2 rounded text-xs font-medium transition-colors ${
                  selected
                    ? `${colors[level - 1]} text-white ring-2 ring-white/30`
                    : 'bg-[var(--card-hover)] text-[var(--muted)] hover:text-white'
                }`}
              >
                {level}{labels[level - 1] ? ` ${labels[level - 1]}` : ''}
              </button>
            );
          })}
        </div>
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
          placeholder="Additional notes..."
        />
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
          className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {submitting ? 'Saving...' : (event ? 'Update Event' : 'Create Event')}
        </button>
      </div>
    </form>
  );
}
