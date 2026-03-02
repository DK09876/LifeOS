'use client';

import { Habit } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { getCompletionsThisWeek } from '@/lib/db';

interface HabitCardProps {
  habit: Habit;
  isDue?: boolean;
  onMarkDone?: (habitId: string) => void;
  onEdit?: (habit: Habit) => void;
  onDelete?: (habitId: string) => void;
  onToggleActive?: (habitId: string) => void;
  compact?: boolean;
}

const getRecurrenceBadgeColor = (recurrence: string) => {
  switch (recurrence) {
    case 'Daily':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Weekly':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Biweekly':
      return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    case 'Monthly':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'Bimonthly':
      return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    case 'Quarterly':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'Half-Yearly':
      return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
    case 'Yearly':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

export default function HabitCard({
  habit,
  isDue = false,
  onMarkDone,
  onEdit,
  onDelete,
  onToggleActive,
  compact = false,
}: HabitCardProps) {
  const lastCompletedText = habit.lastCompleted
    ? `Completed ${formatDistanceToNow(new Date(habit.lastCompleted), { addSuffix: true })}`
    : 'Never completed';

  // For weekly target habits, show progress
  const hasWeeklyTarget = habit.targetPerWeek !== null && habit.targetPerWeek > 0;
  const completionsThisWeek = hasWeeklyTarget ? getCompletionsThisWeek(habit) : 0;
  const weeklyProgressText = hasWeeklyTarget
    ? `${completionsThisWeek}/${habit.targetPerWeek} this week`
    : null;

  if (compact) {
    // Compact version for Today page
    return (
      <div
        className={`bg-[var(--card-bg)] rounded-lg p-4 flex items-center gap-4 group hover:bg-[var(--card-hover)] transition-colors ${
          !habit.isActive ? 'opacity-50' : ''
        }`}
      >
        {/* Check button */}
        {onMarkDone && habit.isActive && (
          <button
            onClick={() => onMarkDone(habit.id)}
            className="w-5 h-5 rounded-full border-2 border-[var(--muted)] hover:border-green-500 hover:bg-green-500/20 flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <span className="opacity-0 group-hover:opacity-100 text-green-500 text-xs">✓</span>
          </button>
        )}

        {/* Icon and name */}
        <div
          className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer"
          onClick={() => onEdit?.(habit)}
        >
          <span className="text-xl flex-shrink-0">{habit.icon || '🔄'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{habit.habitName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {hasWeeklyTarget ? (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-purple-500/20 text-purple-400 border-purple-500/30">
                  {weeklyProgressText}
                </span>
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${getRecurrenceBadgeColor(habit.recurrence)}`}>
                  {habit.recurrence}
                </span>
              )}
              <span className="text-xs text-[var(--muted)]">{lastCompletedText}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full card for Habits page
  return (
    <div
      className={`bg-[var(--card-bg)] rounded-lg p-4 group hover:bg-[var(--card-hover)] transition-colors ${
        !habit.isActive ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Check button (only if due and active) */}
        {isDue && onMarkDone && habit.isActive && (
          <button
            onClick={() => onMarkDone(habit.id)}
            className="w-6 h-6 mt-1 rounded-full border-2 border-[var(--muted)] hover:border-green-500 hover:bg-green-500/20 flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <span className="opacity-0 group-hover:opacity-100 text-green-500 text-sm">✓</span>
          </button>
        )}

        {/* Icon */}
        <span className="text-2xl flex-shrink-0">{habit.icon || '🔄'}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-white font-medium">{habit.habitName}</h3>
              <div className="flex items-center gap-2 mt-1">
                {hasWeeklyTarget ? (
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {weeklyProgressText}
                  </span>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getRecurrenceBadgeColor(habit.recurrence)}`}>
                    {habit.recurrence}
                  </span>
                )}
                {!habit.isActive && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                    Paused
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              {onToggleActive && (
                <button
                  onClick={() => onToggleActive(habit.id)}
                  className="p-1.5 text-[var(--muted)] hover:text-white hover:bg-[var(--border-color)] rounded transition-colors"
                  title={habit.isActive ? 'Pause habit' : 'Resume habit'}
                >
                  {habit.isActive ? '⏸️' : '▶️'}
                </button>
              )}
              {onEdit && (
                <button
                  onClick={() => onEdit(habit)}
                  className="p-1.5 text-[var(--muted)] hover:text-white hover:bg-[var(--border-color)] rounded transition-colors"
                  title="Edit habit"
                >
                  ✏️
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(habit.id)}
                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete habit"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>

          {/* Last completed */}
          <p className="text-sm text-[var(--muted)] mt-2">{lastCompletedText}</p>

          {/* Notes */}
          {habit.notes && (
            <p className="text-sm text-[var(--muted)] mt-2 italic">{habit.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}
