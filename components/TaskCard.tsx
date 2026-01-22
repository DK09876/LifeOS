'use client';

import { format } from 'date-fns';

interface Task {
  id: string;
  taskName: string;
  status: string;
  taskPriority: string;
  taskScore: number;
  dueDate: string | null;
  recurrence: string;
  lastCompleted: string | null;
  needsReset?: boolean;
  actionPoints: string | null;
  notes: string;
  domainPriority?: string | null;
}

interface TaskCardProps {
  task: Task;
  onMarkDone: (taskId: string) => void;
  onUndo: (taskId: string) => void;
  onReset: (taskId: string) => void;
}

export default function TaskCard({ task, onMarkDone, onUndo, onReset }: TaskCardProps) {
  const isDone = task.status === 'Done';
  const isArchived = task.status === 'Archived';

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '1 - Urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case '2 - High':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case '3 - Normal':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case '4 - Low':
        return 'bg-pink-100 text-pink-800 border-pink-300';
      case '5 - Optional':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done':
        return 'bg-green-100 text-green-800';
      case 'Blocked':
        return 'bg-gray-100 text-gray-800';
      case 'Needs Details':
        return 'bg-yellow-100 text-yellow-800';
      case 'Backlog':
        return 'bg-red-100 text-red-800';
      case 'Archived':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${isDone ? 'opacity-60' : ''} bg-white shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className={`font-semibold text-lg ${isDone ? 'line-through text-gray-500' : ''}`}>
              {task.taskName}
            </h3>
            {task.actionPoints && (
              <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                {task.actionPoints} AP
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
              {task.status}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(task.taskPriority)}`}>
              {task.taskPriority}
            </span>
            {task.recurrence && task.recurrence !== 'None' && (
              <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-800">
                {task.recurrence}
              </span>
            )}
            {task.domainPriority && (
              <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                {task.domainPriority}
              </span>
            )}
          </div>

          {task.dueDate && (
            <div className="text-sm mb-2">
              <span className="text-gray-600">Due: </span>
              <span className={`font-medium ${new Date(task.dueDate) < new Date() ? 'text-red-600' : 'text-gray-900'}`}>
                {format(new Date(task.dueDate), 'MMM dd, yyyy')}
              </span>
            </div>
          )}

          {task.notes && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{task.notes}</p>
          )}

          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span>Score: {Math.round(task.taskScore)}</span>
            {task.lastCompleted && (
              <span>Last: {format(new Date(task.lastCompleted), 'MMM dd')}</span>
            )}
            {task.needsReset && (
              <span className="text-orange-600 font-medium">Needs Reset</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {!isDone && !isArchived && (
            <button
              onClick={() => onMarkDone(task.id)}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Done
            </button>
          )}
          {isDone && (
            <button
              onClick={() => onUndo(task.id)}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Undo
            </button>
          )}
          {task.needsReset && (
            <button
              onClick={() => onReset(task.id)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
