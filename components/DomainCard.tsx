'use client';

import { Domain as BaseDomain } from '@/types';

// Extended Domain type with computed fields from useDomains hook
interface Domain extends BaseDomain {
  taskCount?: number;
}

interface DomainCardProps {
  domain: Domain;
  onEdit?: (domain: Domain) => void;
  onDelete?: (domainId: string) => void;
}

export default function DomainCard({ domain, onEdit, onDelete }: DomainCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '1 - Critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case '2 - Important':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case '3 - Maintenance':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="p-4 rounded-lg border-2 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {domain.icon && (
              <span className="text-2xl">{domain.icon}</span>
            )}
            <h3 className="font-semibold text-lg">{domain.name}</h3>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(domain.priority)}`}>
              {domain.priority}
            </span>
            {domain.taskCount !== undefined && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                {domain.taskCount} tasks
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(domain)}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(domain.id)}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
