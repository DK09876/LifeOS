'use client';

import { useState, useEffect } from 'react';
import { Task, Domain, BlockedByEntry, Project } from '@/types';
import { hasCircularDependency } from '@/lib/hooks';

interface TaskFormProps {
  task?: Task | null;
  domains: Domain[];
  allTasks?: Task[];
  projects?: Project[];
  onSubmit: (data: TaskFormData) => void | Promise<void>;
  onCancel: () => void;
}

export interface TaskFormData {
  taskName: string;
  status: Task['status'];
  taskPriority: Task['taskPriority'];
  urgency: Task['urgency'];
  dueDate: string | null;
  plannedDate: string | null;
  recurrence: Task['recurrence'];
  actionPoints: string | null;
  notes: string;
  domainId: string | null;
  projectId: string | null;
  blockedBy: BlockedByEntry[];
}

const STATUS_OPTIONS: Task['status'][] = ['Needs Details', 'Backlog', 'Planned', 'Blocked', 'Done', 'Archived'];
const PRIORITY_OPTIONS: Task['taskPriority'][] = ['1 - Urgent', '2 - High', '3 - Normal', '4 - Low', '5 - Optional'];
const URGENCY_OPTIONS: Task['urgency'][] = ['1 - Critical', '2 - High', '3 - Normal', '4 - Low', '5 - Someday'];
const RECURRENCE_OPTIONS: Task['recurrence'][] = ['None', 'Daily', 'Weekly', 'Biweekly', 'Monthly', 'Bimonthly', 'Quarterly', 'Half-Yearly', 'Yearly'];

const inputClass = "w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelClass = "block text-sm font-medium text-[var(--muted)] mb-1";

export default function TaskForm({ task, domains, allTasks = [], projects = [], onSubmit, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    taskName: '',
    status: 'Needs Details',
    taskPriority: '3 - Normal',
    urgency: '3 - Normal',
    dueDate: null,
    plannedDate: null,
    recurrence: 'None',
    actionPoints: null,
    notes: '',
    domainId: null,
    projectId: null,
    blockedBy: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [noteBlockerText, setNoteBlockerText] = useState('');

  useEffect(() => {
    if (task) {
      setFormData({
        taskName: task.taskName,
        status: task.status,
        taskPriority: task.taskPriority,
        urgency: task.urgency,
        dueDate: task.dueDate,
        plannedDate: task.plannedDate,
        recurrence: task.recurrence,
        actionPoints: task.actionPoints,
        notes: task.notes,
        domainId: task.domainId,
        projectId: task.projectId,
        blockedBy: task.blockedBy || [],
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

  // Blocked-by helpers
  const addTaskBlocker = (taskId: string) => {
    if (!taskId) return;
    // Check if already added
    if (formData.blockedBy.some(e => e.type === 'task' && e.taskId === taskId)) return;
    const newBlockedBy = [...formData.blockedBy, { type: 'task' as const, taskId }];
    const newStatus = newBlockedBy.length > 0 && formData.status !== 'Done' && formData.status !== 'Archived' ? 'Blocked' : formData.status;
    setFormData(prev => ({ ...prev, blockedBy: newBlockedBy, status: newStatus }));
  };

  const addNoteBlocker = () => {
    const note = noteBlockerText.trim();
    if (!note) return;
    const newBlockedBy = [...formData.blockedBy, { type: 'note' as const, note }];
    const newStatus = newBlockedBy.length > 0 && formData.status !== 'Done' && formData.status !== 'Archived' ? 'Blocked' : formData.status;
    setFormData(prev => ({ ...prev, blockedBy: newBlockedBy, status: newStatus }));
    setNoteBlockerText('');
  };

  const removeBlocker = (index: number) => {
    const newBlockedBy = formData.blockedBy.filter((_, i) => i !== index);
    setFormData(prev => {
      // If all blockers removed and was Blocked, auto-determine status
      if (newBlockedBy.length === 0 && prev.status === 'Blocked') {
        return { ...prev, blockedBy: newBlockedBy, status: 'Backlog' };
      }
      return { ...prev, blockedBy: newBlockedBy };
    });
  };

  // Filter tasks eligible as blockers: non-Done, non-Archived, non-deleted, not self, no circular deps
  const eligibleBlockerTasks = allTasks.filter(t => {
    if (t.status === 'Done' || t.status === 'Archived') return false;
    if (task && t.id === task.id) return false;
    // Already added as blocker
    if (formData.blockedBy.some(e => e.type === 'task' && e.taskId === t.id)) return false;
    // Check circular dependency
    if (task && hasCircularDependency(task.id, t.id, allTasks)) return false;
    return true;
  });

  const activeProjects = projects.filter(p => p.status === 'Active');
  const showBlockedBySection = formData.status === 'Blocked' || formData.blockedBy.length > 0;

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

      {/* Status, Priority, and Urgency */}
      <div className="grid grid-cols-3 gap-4">
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
        <div>
          <label htmlFor="urgency" className={labelClass}>
            Urgency
          </label>
          <select
            id="urgency"
            name="urgency"
            value={formData.urgency}
            onChange={handleChange}
            className={inputClass}
          >
            {URGENCY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Domain and Project */}
      <div className="grid grid-cols-2 gap-4">
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
        <div>
          <label htmlFor="projectId" className={labelClass}>
            Project
          </label>
          <select
            id="projectId"
            name="projectId"
            value={formData.projectId || ''}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">No project</option>
            {activeProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.icon ? `${project.icon} ` : ''}{project.name}
              </option>
            ))}
          </select>
        </div>
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

      {/* Blocked By */}
      {showBlockedBySection && (
        <div>
          <label className={labelClass}>Blocked By</label>
          {formData.blockedBy.length > 0 && (
            <div className="space-y-1 mb-2">
              {formData.blockedBy.map((entry, index) => (
                <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm">
                  {entry.type === 'task' ? (
                    <span className="text-yellow-300 truncate flex-1">
                      {allTasks.find(t => t.id === entry.taskId)?.taskName || 'Unknown task'}
                    </span>
                  ) : (
                    <span className="text-orange-300 truncate flex-1">
                      {entry.note}
                    </span>
                  )}
                  <span className="text-xs text-[var(--muted)] flex-shrink-0">{entry.type}</span>
                  <button
                    type="button"
                    onClick={() => removeBlocker(index)}
                    className="text-red-400 hover:text-red-300 flex-shrink-0"
                    aria-label="Remove blocker"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <select
              onChange={(e) => { addTaskBlocker(e.target.value); e.target.value = ''; }}
              className={`${inputClass} flex-1`}
              defaultValue=""
            >
              <option value="" disabled>Add task blocker...</option>
              {eligibleBlockerTasks.map(t => (
                <option key={t.id} value={t.id}>{t.taskName}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={noteBlockerText}
              onChange={(e) => setNoteBlockerText(e.target.value)}
              placeholder="Add note blocker..."
              className={`${inputClass} flex-1`}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNoteBlocker(); } }}
            />
            <button
              type="button"
              onClick={addNoteBlocker}
              disabled={!noteBlockerText.trim()}
              className="px-3 py-2 bg-[var(--card-hover)] text-[var(--muted)] hover:text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

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
