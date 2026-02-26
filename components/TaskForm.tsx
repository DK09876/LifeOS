'use client';

import { useState, useEffect } from 'react';
import { Task, Domain } from '@/types';

interface TaskFormProps {
  task?: Task | null;
  domains: Domain[];
  onSubmit: (data: TaskFormData) => void | Promise<void>;
  onCancel: () => void;
}

export interface TaskFormData {
  taskName: string;
  status: Task['status'];
  taskPriority: Task['taskPriority'];
  dueDate: string | null;
  plannedDate: string | null;
  recurrence: Task['recurrence'];
  actionPoints: string | null;
  notes: string;
  domainId: string | null;
}

const STATUS_OPTIONS: Task['status'][] = ['Needs Details', 'Backlog', 'Planned', 'Blocked', 'Done', 'Archived'];
const PRIORITY_OPTIONS: Task['taskPriority'][] = ['1 - Urgent', '2 - High', '3 - Normal', '4 - Low', '5 - Optional'];
const RECURRENCE_OPTIONS: Task['recurrence'][] = ['None', 'Daily', 'Weekly', 'Biweekly', 'Monthly', 'Bimonthly', 'Quarterly', 'Half-Yearly', 'Yearly'];

const inputClass = "w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelClass = "block text-sm font-medium text-[var(--muted)] mb-1";

export default function TaskForm({ task, domains, onSubmit, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    taskName: '',
    status: 'Needs Details',
    taskPriority: '3 - Normal',
    dueDate: null,
    plannedDate: null,
    recurrence: 'None',
    actionPoints: null,
    notes: '',
    domainId: null,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        taskName: task.taskName,
        status: task.status,
        taskPriority: task.taskPriority,
        dueDate: task.dueDate,
        plannedDate: task.plannedDate,
        recurrence: task.recurrence,
        actionPoints: task.actionPoints,
        notes: task.notes,
        domainId: task.domainId,
      });
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.taskName.trim() || submitting) return;
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
      {/* Task Name */}
      <div>
        <label htmlFor="taskName" className={labelClass}>
          Task Name *
        </label>
        <input
          type="text"
          id="taskName"
          name="taskName"
          value={formData.taskName}
          onChange={handleChange}
          required
          className={inputClass}
          placeholder="Enter task name"
        />
      </div>

      {/* Status and Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="taskPriority" className={labelClass}>
            Priority
          </label>
          <select
            id="taskPriority"
            name="taskPriority"
            value={formData.taskPriority}
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

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="dueDate" className={labelClass}>
            Due Date
          </label>
          <input
            type="date"
            id="dueDate"
            name="dueDate"
            value={formData.dueDate || ''}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="plannedDate" className={labelClass}>
            Planned Date
          </label>
          <input
            type="date"
            id="plannedDate"
            name="plannedDate"
            value={formData.plannedDate || ''}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
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
          className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {submitting ? 'Saving...' : (task ? 'Update Task' : 'Create Task')}
        </button>
      </div>
    </form>
  );
}
