'use client';

import { useState, useEffect } from 'react';
import { Project, Domain } from '@/types';
import { blockImplicitSubmit } from '@/lib/forms';

interface ProjectFormProps {
  project?: Project | null;
  domains: Domain[];
  onSubmit: (data: ProjectFormData) => void | Promise<void>;
  onCancel: () => void;
}

export interface ProjectFormData {
  name: string;
  description: string;
  icon: string | null;
  status: Project['status'];
  domainId: string | null;
  kind: 'bundle' | 'target';
  targetCount: number | null;
  targetUnit: string | null;
  targetDate: string | null;
}

const STATUS_OPTIONS: Project['status'][] = ['Active', 'Completed', 'Archived'];

const inputClass = "w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelClass = "block text-sm font-medium text-[var(--muted)] mb-1";

export default function ProjectForm({ project, domains, onSubmit, onCancel }: ProjectFormProps) {
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    icon: null,
    status: 'Active',
    domainId: null,
    kind: 'bundle',
    targetCount: null,
    targetUnit: null,
    targetDate: null,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description,
        icon: project.icon,
        status: project.status,
        domainId: project.domainId,
        kind: project.kind ?? 'bundle',
        targetCount: project.targetCount ?? null,
        targetUnit: project.targetUnit ?? null,
        targetDate: project.targetDate ?? null,
      });
    }
  }, [project]);

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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? null : value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} onKeyDown={blockImplicitSubmit} className="space-y-4">
      {/* Project Name */}
      <div>
        <label htmlFor="name" className={labelClass}>
          Project Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className={inputClass}
          placeholder="Enter project name"
        />
      </div>

      {/* Icon and Status */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="icon" className={labelClass}>
            Icon (emoji)
          </label>
          <input
            type="text"
            id="icon"
            name="icon"
            value={formData.icon || ''}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. 🚀"
            maxLength={4}
          />
        </div>
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
      </div>

      {/* What shape of project this is. The two measure progress in
          different currencies, so it has to be said up front. */}
      <div>
        <label className={labelClass}>What kind</label>
        <div className="flex gap-2">
          {([
            { value: 'bundle' as const, title: 'A pile of work',
              blurb: 'A set of tasks, finished when they are all done. "Get the house clean."' },
            { value: 'target' as const, title: 'A goal you count towards',
              blurb: 'Something you chip away at and log. "Read a page, 300 times."' },
          ]).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, kind: option.value }))}
              className={`flex-1 rounded-lg border-2 p-3 text-left transition-colors ${
                formData.kind === option.value
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-[var(--border-color)] hover:border-[var(--muted)]'
              }`}
            >
              <span className="block text-sm font-medium text-white">{option.title}</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">{option.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      {formData.kind === 'target' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="targetCount" className={labelClass}>How many</label>
            <input
              type="number"
              id="targetCount"
              name="targetCount"
              min={1}
              value={formData.targetCount ?? ''}
              onChange={(e) => setFormData((prev) => ({
                ...prev, targetCount: e.target.value ? Math.max(1, parseInt(e.target.value)) : null,
              }))}
              placeholder="300"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="targetUnit" className={labelClass}>Of what</label>
            <input
              type="text"
              id="targetUnit"
              name="targetUnit"
              value={formData.targetUnit ?? ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, targetUnit: e.target.value || null }))}
              placeholder="pages, sessions, km"
              className={inputClass}
            />
          </div>
          <p className="col-span-2 -mt-2 text-xs text-[var(--muted)]">
            Leave the count blank to just tally up with no finish line.
          </p>
          <div className="col-span-2">
            <label htmlFor="targetDate" className={labelClass}>
              Finish by <span className="font-normal">(optional)</span>
            </label>
            <input
              type="date"
              id="targetDate"
              name="targetDate"
              value={formData.targetDate ?? ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, targetDate: e.target.value || null }))}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Shows the pace needed (&ldquo;3 a day&rdquo;) and whether you are ahead. It never nags.
            </p>
          </div>
        </div>
      )}

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

      {/* Description */}
      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className={inputClass}
          placeholder="What is this project about?"
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
          {submitting ? 'Saving...' : (project ? 'Update Project' : 'Create Project')}
        </button>
      </div>
    </form>
  );
}
