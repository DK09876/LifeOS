export interface Task {
  id: string;
  taskName: string;
  status: 'Needs Details' | 'Backlog' | 'Blocked' | 'Done' | 'Archived';
  taskPriority: '1 - Urgent' | '2 - High' | '3 - Normal' | '4 - Low' | '5 - Optional';
  taskScore: number;
  dueDate: string | null;
  plannedDate: string | null;
  recurrence: 'None' | 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  lastCompleted: string | null;
  needsReset: boolean;
  actionPoints: string | null;
  notes: string;
  domain: Domain | null;
  domainPriority: string | null;
  url: string;
}

export interface Domain {
  id: string;
  domain: string;
  domainPriority: '1 - Critical' | '2 - Important' | '3 - Maintenance';
  taskCount: number;
  url: string;
}

export interface TaskFilter {
  status?: string[];
  priority?: string[];
  domain?: string[];
  dueDate?: 'overdue' | 'today' | 'week' | 'all';
}
