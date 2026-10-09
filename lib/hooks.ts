'use client';

import { useEffect, useMemo } from 'react';
import { useLiveQuery } from './live-query';
import { db, isHabitDueToday } from './db';
import { getTodayString } from './dates';
import { getPreference, savePreference } from './store';
import { projectProgress } from './progress';
import { CAPACITY_PREF, WEEKDAY_BUDGET_PREF } from './capacity';
import { createActions, RECURRENCE_LAST_RUN } from './actions';

// The app's actions, bound to the browser's copy of the data. The same
// functions run on the Pi for the voice assistant (lib/server/assistant.ts).
const actions = createActions({ db, getPreference, savePreference });
export const {
  planOccurrence,
  readEnergySettings,
  recordDay,
  runRecurrenceCheck,
  getRecurrenceCheckStatus,
  createFilterPreset,
  updateFilterPreset,
  deleteFilterPreset,
  toggleFilterPresetVisibility,
  hasCircularDependency,
  markTaskDone,
  undoTaskDone,
  reopenTask,
  completionDaysOf,
  resetTask,
  createTask,
  isSlip,
  updateTaskData,
  deleteTask,
  createDomain,
  updateDomainData,
  deleteDomain,
  markHabitDone,
  undoHabitDone,
  createHabit,
  updateHabitData,
  deleteHabit,
  toggleHabitActive,
  createEvent,
  updateEventData,
  markEventDone,
  undoEventDone,
  deleteEvent,
  logProjectProgress,
  createProject,
  updateProjectData,
  deleteProject,
  createNote,
  updateNote,
  deleteNote,
} = actions;
const { runRecurrenceCheckCore } = actions;


/** The same, reactive: re-reads whenever any of the three preferences change. */
export function useEnergySettings() {
  const suggest = useLiveQuery(() => getPreference('suggest.settings'), []);
  const capacity = useLiveQuery(() => getPreference(CAPACITY_PREF), []);
  const weekday = useLiveQuery(() => getPreference(WEEKDAY_BUDGET_PREF), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readEnergySettings(), [suggest, capacity, weekday]);
}

// Hook to run daily auto-reset check for recurring tasks (runs once on app load)
export function useRecurrenceCheck() {
  useEffect(() => {
    (async () => {
      if (getPreference(RECURRENCE_LAST_RUN) === getTodayString()) return;
      await runRecurrenceCheckCore();
    })();
  }, []);
}

// Hook to get all tasks with computed fields
export function useTasks() {
  const tasks = useLiveQuery(async () => {
    const allTasks = (await db.tasks.toArray()).filter(t => !t.deletedAt);
    const domains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const domainMap = new Map(domains.map(d => [d.id, d]));

    // Add computed fields
    return allTasks.map(task => {
      const domain = task.domainId ? domainMap.get(task.domainId) : null;
      return {
        ...task,
        domain: domain || null,
        domainPriority: domain?.priority || null,
      };
    }).sort((a, b) => b.taskScore - a.taskScore || a.taskName.localeCompare(b.taskName));
  }, []);

  return tasks || [];
}

// Hook to get all domains with task counts
export function useDomains() {
  const domains = useLiveQuery(async () => {
    const allDomains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const allTasks = (await db.tasks.toArray()).filter(t => !t.deletedAt);

    // Add task counts
    return allDomains.map(domain => ({
      ...domain,
      taskCount: allTasks.filter(t => t.domainId === domain.id).length,
    })).sort((a, b) => a.priority.localeCompare(b.priority));
  }, []);

  return domains || [];
}

// Hook to get a single task
export function useTask(id: string) {
  return useLiveQuery(async () => {
    const task = await db.tasks.get(id);
    if (!task) return null;

    const domain = task.domainId ? await db.domains.get(task.domainId) : null;
    return {
      ...task,
      domain: domain || null,
      domainPriority: domain?.priority || null,
    };
  }, [id]);
}

// Hook to get a single domain
export function useDomain(id: string) {
  return useLiveQuery(async () => {
    const domain = await db.domains.get(id);
    if (!domain) return null;

    const allDomainTasks = await db.tasks.where('domainId').equals(id).toArray();
    const taskCount = allDomainTasks.filter(t => !t.deletedAt).length;
    return { ...domain, taskCount };
  }, [id]);
}

// Hook to get all filter presets
export function useFilterPresets() {
  const presets = useLiveQuery(async () => {
    const all = await db.filterPresets.orderBy('order').toArray();
    return all.filter(p => !p.deletedAt);
  }, []);

  return presets || [];
}

// Hook to get visible filter presets only
export function useVisibleFilterPresets() {
  const presets = useLiveQuery(async () => {
    const all = await db.filterPresets.orderBy('order').toArray();
    return all.filter(p => p.visible && !p.deletedAt);
  }, []);

  return presets || [];
}

// Habit hooks and actions

// Hook to get all habits
export function useHabits() {
  const habits = useLiveQuery(async () => {
    const all = await db.habits.orderBy('habitName').toArray();
    return all.filter(h => !h.deletedAt);
  }, []);

  return habits || [];
}

// Hook to get habits that are due today (active and need completion)
export function useHabitsDueToday() {
  const habits = useLiveQuery(async () => {
    const allHabits = (await db.habits.toArray()).filter(h => !h.deletedAt);
    return allHabits.filter(habit => isHabitDueToday(habit))
      .sort((a, b) => a.habitName.localeCompare(b.habitName));
  }, []);

  return habits || [];
}

// Hook to get habits completed today (for showing in Today view's completed section)
export function useHabitsCompletedToday() {
  const habits = useLiveQuery(async () => {
    const todayStr = getTodayString();
    const allHabits = (await db.habits.toArray()).filter(h => !h.deletedAt);
    return allHabits.filter(habit =>
      habit.isActive && (habit.completionDates || []).includes(todayStr)
    ).sort((a, b) => a.habitName.localeCompare(b.habitName));
  }, []);

  return habits || [];
}

// Event hooks and actions

// Hook to get all events with computed domain
export function useEvents() {
  const events = useLiveQuery(async () => {
    const allEvents = (await db.events.toArray()).filter(e => !e.deletedAt);
    const domains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const domainMap = new Map(domains.map(d => [d.id, d]));

    return allEvents.map(event => ({
      ...event,
      domain: event.domainId ? domainMap.get(event.domainId) || null : null,
    })).sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      const timeCompare = (a.time || '').localeCompare(b.time || '');
      if (timeCompare !== 0) return timeCompare;
      return a.eventName.localeCompare(b.eventName);
    });
  }, []);

  return events || [];
}

// Hook to get events for today (excludes completed ones)
export function useEventsToday() {
  const events = useLiveQuery(async () => {
    const todayStr = getTodayString();
    const allEvents = (await db.events.toArray()).filter(e => !e.deletedAt);
    const domains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const domainMap = new Map(domains.map(d => [d.id, d]));

    return allEvents
      .filter(e => e.date === todayStr && e.lastCompleted !== todayStr)
      .map(event => ({
        ...event,
        domain: event.domainId ? domainMap.get(event.domainId) || null : null,
      }))
      .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.eventName.localeCompare(b.eventName));
  }, []);

  return events || [];
}

// Hook to get events completed today
export function useEventsCompletedToday() {
  const events = useLiveQuery(async () => {
    const todayStr = getTodayString();
    const allEvents = (await db.events.toArray()).filter(e => !e.deletedAt);
    const domains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const domainMap = new Map(domains.map(d => [d.id, d]));

    return allEvents
      .filter(e => e.date === todayStr && e.lastCompleted === todayStr)
      .map(event => ({
        ...event,
        domain: event.domainId ? domainMap.get(event.domainId) || null : null,
      }))
      .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.eventName.localeCompare(b.eventName));
  }, []);

  return events || [];
}

// --- Project hooks and actions ---

const DEFAULT_AP = 2;

// Hook to get all projects with computed fields
export function useProjects() {
  const projects = useLiveQuery(async () => {
    const allProjects = (await db.projects.toArray()).filter(p => !p.deletedAt);
    const allTasks = (await db.tasks.toArray()).filter(t => !t.deletedAt);
    const domains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const domainMap = new Map(domains.map(d => [d.id, d]));

    return allProjects.map(project => {
      const projectTasks = allTasks.filter(t => t.projectId === project.id);
      const completedTasks = projectTasks.filter(t => t.status === 'Done' || t.status === 'Archived');
      const totalAP = projectTasks.reduce((sum, t) => sum + (parseInt(t.actionPoints || '0') || DEFAULT_AP), 0);
      const completedAP = completedTasks.reduce((sum, t) => sum + (parseInt(t.actionPoints || '0') || DEFAULT_AP), 0);

      // A target project measures logged work, not the state of task rows.
      const progress = projectProgress(project, projectTasks);

      return {
        ...project,
        domain: project.domainId ? domainMap.get(project.domainId) || null : null,
        tasks: projectTasks,
        taskCount: projectTasks.length,
        completedTaskCount: completedTasks.length,
        totalAP,
        completedAP,
        progress,
        completionPercent: progress.percent,
      };
    }).sort((a, b) => {
      // Active first, then Completed, then Archived
      const statusOrder = { Active: 0, Completed: 1, Archived: 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.name.localeCompare(b.name);
    });
  }, []);

  return projects || [];
}

// --- Notes and lists -------------------------------------------------------

export function useNotes() {
  const notes = useLiveQuery(async () => {
    const all = (await db.notes.toArray()).filter(n => !n.deletedAt);
    // Pinned first, then most recently touched.
    return all.sort((a, b) =>
      Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  }, []);
  return notes || [];
}
