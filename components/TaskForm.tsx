'use client';

import { levelLabel } from '@/lib/colors';
import { useState, useEffect } from 'react';
import { Task, Domain, BlockedByEntry, Project } from '@/types';
import { hasCircularDependency } from '@/lib/hooks';
import { EFFORT_LEVELS, effortLevel } from '@/lib/effort';
import { blockImplicitSubmit } from '@/lib/forms';

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
  recurrenceAnchor: Task['recurrenceAnchor'];
  recurrenceWeekdays: Task['recurrenceWeekdays'];
  recurrenceEnd: string | null;
  actionPoints: string | null;
  notes: string;
  domainId: string | null;
  projectId: string | null;
  blockedBy: BlockedByEntry[];
  followUpDate: string | null;
}

const STATUS_OPTIONS: Task['status'][] = ['Needs Details', 'Backlog', 'Planned', 'Blocked', 'Done', 'Archived'];
const PRIORITY_OPTIONS: NonNullable<Task['taskPriority']>[] = ['1 - Urgent', '2 - High', '3 - Normal', '4 - Low', '5 - Optional'];
const URGENCY_OPTIONS: NonNullable<Task['urgency']>[] = ['1 - Critical', '2 - High', '3 - Normal', '4 - Low', '5 - Someday'];
/** Sunday first, matching Date.getDay(). */
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const RECURRENCE_OPTIONS: Task['recurrence'][] = ['None', 'Daily', 'Weekly', 'Biweekly', 'Monthly', 'Bimonthly', 'Quarterly', 'Half-Yearly', 'Yearly'];

const inputClass = "w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelClass = "block text-sm font-medium text-[var(--muted)] mb-1";

export default function TaskForm({ task, domains, allTasks = [], projects = [], onSubmit, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    taskName: '',
    status: 'Needs Details',
    taskPriority: null,
    urgency: null,
    dueDate: null,
    plannedDate: null,
    recurrence: 'None',
    recurrenceAnchor: null,
    recurrenceWeekdays: null,
    recurrenceEnd: null,
    actionPoints: null,
    notes: '',
    domainId: null,
    projectId: null,
    blockedBy: [],
    followUpDate: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // How many of the optional fields this task actually uses. Shown on the
  // collapsed toggle so nothing set earlier can hide behind it unnoticed.
  const extrasInUse = [
    formData.plannedDate,
    formData.projectId,
    formData.recurrence !== 'None' ? formData.recurrence : null,
    formData.blockedBy.length ? 'blocked' : null,
    formData.notes?.trim() ? 'notes' : null,
  ].filter(Boolean).length;
  const [noteBlockerText, setNoteBlockerText] = useState('');

  // Open the section when editing something that already uses it, so an
  // existing recurrence or blocker is never hidden behind a collapsed toggle.
  // Read from the task rather than formData: this runs alongside the effect
  // that populates the form, so formData is still empty at this point.
  useEffect(() => {
    const usesExtras = !!task && (
      !!task.plannedDate || !!task.projectId ||
      task.recurrence !== 'None' || (task.blockedBy?.length ?? 0) > 0 ||
      !!task.notes?.trim()
    );
    setShowMore(usesExtras);
    // Only when switching task: reopening on every keystroke would stop the
    // user closing it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

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
        recurrenceAnchor: task.recurrenceAnchor,
        recurrenceWeekdays: task.recurrenceWeekdays,
        recurrenceEnd: task.recurrenceEnd ?? null,
        actionPoints: task.actionPoints,
        notes: task.notes,
        domainId: task.domainId,
        projectId: task.projectId,
        blockedBy: task.blockedBy || [],
        followUpDate: task.followUpDate,
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
    <form onSubmit={handleSubmit} onKeyDown={blockImplicitSubmit} className="space-y-4">
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

      {/* Priority and Urgency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="taskPriority" className={labelClass}>
            Priority
          </label>
          <select
            id="taskPriority"
            name="taskPriority"
            value={formData.taskPriority ?? ''}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">Not set</option>
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt[0]} - {levelLabel(opt)}
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
            value={formData.urgency ?? ''}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">Not set</option>
            {URGENCY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Domain */}
      <div>
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
      </div>

      {/* Due date */}
      <div>
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
      </div>

      {/* Action Points */}
      <div>
        <label className={labelClass}>
          Action Points
        </label>
        <div className="flex gap-1">
          {EFFORT_LEVELS.filter((l) => l.value > 0).map(({ value, name }) => {
            const selected = formData.actionPoints === String(value);
            const colors: Record<number, string> = {
              1: 'bg-green-600 hover:bg-green-500',
              2: 'bg-lime-600 hover:bg-lime-500',
              3: 'bg-yellow-600 hover:bg-yellow-500',
              4: 'bg-orange-600 hover:bg-orange-500',
              5: 'bg-red-600 hover:bg-red-500',
            };
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    actionPoints: prev.actionPoints === String(value) ? null : String(value),
                  }))
                }
                className={`flex-1 py-2 rounded text-xs font-medium transition-colors ${
                  selected
                    ? `${colors[value]} text-white ring-2 ring-white/30`
                    : 'bg-[var(--card-hover)] text-[var(--muted)] hover:text-white'
                }`}
              >
                {value} {name}
              </button>
            );
          })}
        </div>
        {/* A scale nobody can apply consistently is not a scale, so each rung
            says what it means rather than leaving 1-5 to interpretation. */}
        <p className="text-xs text-[var(--muted)] mt-1 min-h-[1rem]">
          {effortLevel(formData.actionPoints)?.hint ?? 'How much of a day does this cost?'}
        </p>
      </div>

      {/* Everything below is optional. Most tasks are a name, how much they
          matter, where they belong and what they cost - putting eleven fields
          in front of that made writing one down feel like filing a form. */}
      <div className="border-t border-[var(--border-color)] pt-3">
        <button
          type="button"
          onClick={() => setShowMore((open) => !open)}
          className="text-sm text-[var(--muted)] hover:text-white flex items-center gap-1"
          aria-expanded={showMore}
        >
          <span className={`transition-transform ${showMore ? 'rotate-90' : ''}`}>›</span>
          {showMore ? 'Fewer options' : 'More options'}
          {!showMore && extrasInUse > 0 && (
            <span className="ml-1 text-xs px-1.5 rounded-full bg-[var(--card-hover)]">{extrasInUse}</span>
          )}
        </button>
      </div>

      {showMore && (
        <div className="space-y-4">
        {/* Status */}
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

        {/* Planned date */}
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

        {/* Project */}
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

        {formData.recurrence === 'Weekly' && (
          <div className="mt-2">
            <label className={labelClass}>On which days</label>
            <div className="flex gap-1">
              {WEEKDAY_LABELS.map((label, day) => {
                const picked = (formData.recurrenceWeekdays || []).includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setFormData((prev) => {
                      const current = prev.recurrenceWeekdays || [];
                      const next = current.includes(day)
                        ? current.filter((d) => d !== day)
                        : [...current, day].sort((a, b) => a - b);
                      return { ...prev, recurrenceWeekdays: next.length ? next : null };
                    })}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                      picked
                        ? 'bg-blue-600 text-white'
                        : 'bg-[var(--card-hover)] text-[var(--muted)] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              {formData.recurrenceWeekdays?.length
                ? 'It comes back on the next of these days.'
                : 'Leave blank for a plain week after each time you do it.'}
            </p>
          </div>
        )}

        {formData.recurrence !== 'None' && (
          <div className="mt-2">
            <label htmlFor="recurrenceAnchor" className={labelClass}>
              Next one is counted from
            </label>
            <select
              id="recurrenceAnchor"
              name="recurrenceAnchor"
              value={formData.recurrenceAnchor ?? 'completion'}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="completion">When I finish it</option>
              <option value="schedule">The due date (fixed period)</option>
            </select>
            <p className="text-xs text-[var(--muted)] mt-1">
              {formData.recurrenceAnchor === 'schedule'
                ? 'Deadlines stay put whether you are early or late — for things with a real period, like a fortnightly return.'
                : 'The clock restarts when you finish — for things you just want to do every so often.'}
            </p>
            <label htmlFor="recurrenceEnd" className={`${labelClass} mt-2`}>
              Repeat until <span className="font-normal">(optional)</span>
            </label>
            <input
              type="date"
              id="recurrenceEnd"
              name="recurrenceEnd"
              value={formData.recurrenceEnd || ''}
              onChange={handleChange}
              className={inputClass}
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              {formData.recurrenceEnd
                ? 'Stops coming back after this date — for a repeating task with an end in mind.'
                : 'Leave blank to repeat for as long as it is here. Something with no end is probably a habit.'}
            </p>
          </div>
        )}
      </div>

      {/* Blocked By */}
      {showBlockedBySection && (
        <div>
          <label className={labelClass}>Blocked By</label>
          <div className="mb-2">
            <label htmlFor="followUpDate" className="block text-xs text-[var(--muted)] mb-1">
              Chase it up on
            </label>
            <input
              type="date"
              id="followUpDate"
              name="followUpDate"
              value={formData.followUpDate || ''}
              onChange={handleChange}
              className={inputClass}
            />
            {/* Waiting is not neglect, so a blocked task stays quiet and stops
                scoring. This date is what brings it back deliberately. */}
            <p className="text-xs text-[var(--muted)] mt-1">
              While blocked this task stays quiet. On this day it asks to be chased.
            </p>
          </div>
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

        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border-color)] sticky bottom-0 -mx-4 px-4 pb-4 sm:pb-0 bg-[var(--card-bg)] z-10">
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
