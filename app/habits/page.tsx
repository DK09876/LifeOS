'use client';

import { useState, useMemo } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import HabitForm, { HabitFormData } from '@/components/HabitForm';
import HabitCard from '@/components/HabitCard';
import { useToast } from '@/components/Toast';
import { useHabits, createHabit, updateHabitData, deleteHabit, markHabitDone, toggleHabitActive } from '@/lib/hooks';
import { isHabitDueToday } from '@/lib/db';
import { Habit } from '@/types';

export default function HabitsPage() {
  const habits = useHabits();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);

  // Categorize habits
  const { dueNow, onTrack, paused } = useMemo(() => {
    const dueNow: Habit[] = [];
    const onTrack: Habit[] = [];
    const paused: Habit[] = [];

    for (const habit of habits) {
      if (!habit.isActive) {
        paused.push(habit);
      } else if (isHabitDueToday(habit)) {
        dueNow.push(habit);
      } else {
        onTrack.push(habit);
      }
    }

    return { dueNow, onTrack, paused };
  }, [habits]);

  const { showToast } = useToast();

  // Handlers
  function handleOpenCreate() {
    setEditingHabit(null);
    setIsModalOpen(true);
  }

  function handleEdit(habit: Habit) {
    setEditingHabit(habit);
    setIsModalOpen(true);
  }

  async function handleSubmit(data: HabitFormData) {
    try {
      if (editingHabit) {
        await updateHabitData(editingHabit.id, data);
      } else {
        await createHabit(data);
      }
      setIsModalOpen(false);
      setEditingHabit(null);
    } catch { showToast('Failed to save habit', 'error'); }
  }

  async function handleConfirmDelete() {
    try {
      if (habitToDelete) {
        await deleteHabit(habitToDelete);
        setHabitToDelete(null);
      }
    } catch { showToast('Failed to delete habit', 'error'); }
  }

  async function handleMarkDone(habitId: string) {
    try {
      await markHabitDone(habitId);
    } catch { showToast('Failed to complete habit', 'error'); }
  }

  async function handleToggleActive(habitId: string) {
    try {
      await toggleHabitActive(habitId);
    } catch { showToast('Failed to update habit', 'error'); }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Habits</h1>
          <p className="text-[var(--muted)]">
            {habits.length} total habits ({dueNow.length} due, {onTrack.length} on track, {paused.length} paused)
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          + New Habit
        </button>
      </div>

      {/* Due Now Section */}
      {dueNow.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            Due Now
          </h2>
          <div className="space-y-3">
            {dueNow.map(habit => (
              <HabitCard
                key={habit.id}
                habit={habit}
                isDue={true}
                onMarkDone={handleMarkDone}
                onEdit={handleEdit}
                onDelete={setHabitToDelete}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        </div>
      )}

      {/* On Track Section */}
      {onTrack.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            On Track
          </h2>
          <div className="space-y-3">
            {onTrack.map(habit => (
              <HabitCard
                key={habit.id}
                habit={habit}
                isDue={false}
                onEdit={handleEdit}
                onDelete={setHabitToDelete}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        </div>
      )}

      {/* Paused Section */}
      {paused.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-[var(--muted)] mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-500"></span>
            Paused
          </h2>
          <div className="space-y-3">
            {paused.map(habit => (
              <HabitCard
                key={habit.id}
                habit={habit}
                isDue={false}
                onEdit={handleEdit}
                onDelete={setHabitToDelete}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {habits.length === 0 && (
        <div className="bg-[var(--card-bg)] rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">🔄</div>
          <h3 className="text-lg font-medium text-white mb-2">No habits yet</h3>
          <p className="text-[var(--muted)] mb-6">
            Create your first habit to start building better routines.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            + Create Habit
          </button>
        </div>
      )}

      {/* Modals */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingHabit(null); }}
        title={editingHabit ? 'Edit Habit' : 'Create Habit'}
        maxWidth="lg"
      >
        <HabitForm
          key={editingHabit?.id ?? 'new'}
          habit={editingHabit}
          onSubmit={handleSubmit}
          onCancel={() => { setIsModalOpen(false); setEditingHabit(null); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={habitToDelete !== null}
        onClose={() => setHabitToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Habit"
        message="Are you sure you want to delete this habit? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
