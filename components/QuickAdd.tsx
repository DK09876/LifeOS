'use client';

/**
 * Capture a task from anywhere.
 *
 * Adding is by far the most frequent thing anyone does here, and until now it
 * cost a navigation first: you had to be on the right page before you could
 * write a thought down. A thought you have to navigate to record is a thought
 * you lose.
 *
 * Deliberately the same TaskForm as everywhere else, so a task captured in a
 * hurry is a real task with the same promotion rules, not a second-class one.
 */

import { useCallback, useEffect, useState } from 'react';

import Modal from './Modal';
import TaskForm, { TaskFormData } from './TaskForm';
import { useToast } from './Toast';
import { createTask, useDomains, useProjects, useTasks } from '@/lib/hooks';

export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const tasks = useTasks();
  const domains = useDomains();
  const projects = useProjects();
  const { showToast } = useToast();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return;
      // Never steal the key from someone who is typing - including in a
      // contenteditable, which is not an input but takes text all the same.
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const submit = useCallback(async (data: TaskFormData) => {
    try {
      await createTask(data);
      setOpen(false);
      showToast('Task added', 'success');
    } catch {
      showToast('Could not add that task', 'error');
    }
  }, [showToast]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="New task (n)"
        aria-label="New task"
        className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-lg leading-none flex items-center justify-center flex-shrink-0"
      >
        +
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="New Task" maxWidth="lg">
        <TaskForm
          task={null}
          domains={domains}
          allTasks={tasks}
          projects={projects}
          onSubmit={submit}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
