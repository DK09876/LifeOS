'use client';

import { useState, useEffect } from 'react';
import { Project, Domain } from '@/types';

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
    <form onSubmit={handleSubmit} className="space-y-4">
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
