import { startOfDay } from 'date-fns';

// Task priority → badge color (bg + text)
export function getTaskPriorityColor(priority: string): string {
  switch (priority) {
    case '1 - Urgent': return 'bg-red-500/20 text-red-400';
    case '2 - High': return 'bg-orange-500/20 text-orange-400';
    case '3 - Normal': return 'bg-blue-500/20 text-blue-400';
    case '4 - Low': return 'bg-gray-500/20 text-gray-400';
    case '5 - Optional': return 'bg-gray-600/20 text-gray-500';
    default: return 'bg-blue-500/20 text-blue-400';
  }
}

// Task priority → border-l color (for Today page cards)
export function getTaskPriorityBorder(priority: string): string {
  switch (priority) {
    case '1 - Urgent': return 'border-l-red-500 bg-red-500/5';
    case '2 - High': return 'border-l-orange-500 bg-orange-500/5';
    case '3 - Normal': return 'border-l-blue-500 bg-blue-500/5';
    case '4 - Low': return 'border-l-gray-500 bg-gray-500/5';
    case '5 - Optional': return 'border-l-gray-600 bg-gray-600/5';
    default: return 'border-l-blue-500';
  }
}

// Task priority → small dot color
export function getPriorityDotColor(priority: string): string {
  switch (priority) {
    case '1 - Urgent': return 'bg-red-500';
    case '2 - High': return 'bg-orange-500';
    case '3 - Normal': return 'bg-blue-500';
    case '4 - Low': return 'bg-gray-500';
    case '5 - Optional': return 'bg-gray-600';
    default: return 'bg-blue-500';
  }
}

// Domain priority → badge color
export function getDomainPriorityColor(priority: string): string {
  switch (priority) {
    case '1 - Critical': return 'bg-red-500/20 text-red-400';
    case '2 - Important': return 'bg-orange-500/20 text-orange-400';
    case '3 - Maintenance': return 'bg-blue-500/20 text-blue-400';
    default: return 'bg-blue-500/20 text-blue-400';
  }
}

// Task status → badge color
export function getStatusColor(status: string): string {
  switch (status) {
    case 'Done': return 'bg-green-500/20 text-green-400';
    case 'Blocked': return 'bg-gray-500/20 text-gray-400';
    case 'Needs Details': return 'bg-yellow-500/20 text-yellow-400';
    case 'Backlog': return 'bg-blue-500/20 text-blue-400';
    case 'Planned': return 'bg-purple-500/20 text-purple-400';
    case 'Archived': return 'bg-gray-600/20 text-gray-500';
    default: return 'bg-blue-500/20 text-blue-400';
  }
}

// Due date → proximity text color
export function getDueDateColor(dueDate: string | null): string {
  if (!dueDate) return 'text-[var(--muted)]';
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(new Date());
  const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return 'text-red-400 font-medium';
  if (daysUntil === 0) return 'text-orange-400 font-medium';
  if (daysUntil <= 2) return 'text-yellow-400';
  if (daysUntil <= 7) return 'text-blue-400';
  return 'text-[var(--muted)]';
}
