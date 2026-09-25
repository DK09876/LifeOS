# CLAUDE.md

This file provides context for Claude Code when working on this repository.

## Project Overview

LifeOS is a **self-hosted** personal productivity app — tasks, habits, events, and
projects. A Raspberry Pi on the user's tailnet runs the app and holds the
authoritative SQLite database; browsers keep an in-memory copy and write back
to the server.

**Key Principle**: no cloud account and no third party. Each profile's data is
separate, and the user can download and restore it themselves.

## Architecture

```
Browser                          Raspberry Pi
┌─────────────────┐             ┌──────────────────────┐
│  React UI       │             │  Next.js (port 3000) │
│       ↓↑        │  HTTP ─────→│        ↓↑            │
│  in-memory copy │←─── poll 2s │  SQLite (lifeos.db)  │
└─────────────────┘             │        ↑             │
                                │  pantry (voice)      │
                                └──────────────────────┘
```

### Data Flow
1. A change writes to the server immediately and updates the local copy
2. The client polls every 2s and adopts the server's view, so a change made on
   another device — or by the voice assistant writing directly — appears without
   a refresh
3. `/api/data?profile=<id>` is the read/write endpoint; `/api/sync` is the
   token-authenticated equivalent used by other clients

### Deletion Model
- Records get `deletedAt` (soft delete / tombstone) instead of being removed
- Tombstones stop a delete on one device being resurrected by another that had
  not caught up

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React 19 + Tailwind CSS 4
- **Client store**: in-memory copy of the profile, polled from the server
- **Server**: Next.js route handlers on the Pi, SQLite via `node-sqlite3-wasm`
- **Auth**: per-user bearer tokens on `/api/sync`; `/api/data` is unauthenticated
  and relies on the tailnet for isolation
- **Date Handling**: date-fns

## Key Files

| File | Purpose |
|------|---------|
| `lib/db.ts` | CRUD over the store shim; re-exports types and the pure rules below |
| `lib/recurrence.ts` | Pure: recurrence dates, resets (calendar days), projected occurrences, habit due-ness, event rollover |
| `lib/scoring.ts` | Pure: task scores, pressure ladders (deadline / cycle / missed plan / neglect + slips), pressing blocked |
| `lib/notifications.ts` | Pure: the notices the bell shows and the Pi pushes (one rule set for both) |
| `lib/review.ts` | Pure: week/month review — backlog trend, energy, domains, slips, habits |
| `lib/milestones.ts` | Habit milestone ladders |
| `lib/server/notifier.ts` | Once-a-minute clock on the Pi that pushes due notices (started from `instrumentation.ts`) |
| `lib/server/push.ts` | Web Push: VAPID keys (generated, stored in `_system` prefs), sending |
| `lib/hooks.ts` | React hooks: `useTasks()`, `useDomains()`, `useHabits()`, `useEvents()`, `useProjects()`, action functions |
| `lib/store.ts` | Client store: hydrate, poll, read/write against `/api/data` |
| `lib/server/store.ts` | Server store: SQLite schema, per-profile reads and writes |
| `lib/schedule.ts` | Where a task sits on a calendar: planned date, else due date, once |
| `lib/capacity.ts` | The day's AP budget and what has been spent against it |
| `lib/streaks.ts` | Habit streaks (days, or target-hitting weeks) and 30-day history |
| `lib/backup-file.ts` | Backup export/import: build, name, and validate the JSON file |
| `lib/colors.ts` | Shared color utility functions (priority, status, due date colors) |
| `lib/suggest.ts` | Auto-suggest algorithm: scoring, suggestNextTask, suggestWeekSchedule (pure functions) |
| `components/AppLayout.tsx` | Main layout: sidebar, header with quick-add and profile switcher |
| `app/page.tsx` | Today view: due tasks + habits, completed today |
| `app/plan/page.tsx` | Triage + Planning with drag-and-drop calendar + Eisenhower Matrix + Auto-Suggest |
| `app/projects/page.tsx` | Projects management: cards, progress bars, task lists |
| `app/habits/page.tsx` | Habits management: due now, on track, paused |
| `app/yesterday/page.tsx` | Back-date completions to yesterday (tasks, habits, events, goals) |
| `app/notes/page.tsx` | Notes & checklists (`notes` collection) — not tasks |
| `app/retrospect/page.tsx` | Review: week / month / last 4 weeks |

## Data Models

All models include `deletedAt: string | null` for tombstone-based soft deletes.

### Task
```typescript
{
  id: string;
  taskName: string;
  status: 'Needs Details' | 'Backlog' | 'Planned' | 'Blocked' | 'Done' | 'Archived';
  taskPriority: '1 - Urgent' | ... | '5 - Optional' | null;   // null = not yet decided
  urgency: '1 - Critical' | ... | '5 - Someday' | null;       // null = not yet decided
  importanceScore: number;   // priority + domain, range 20-80
  urgencyScore: number;      // urgency field + time pressure, range 10-120
  taskScore: number;         // combined: (importance × urgency) / 100
  dueDate: string | null;
  plannedDate: string | null;
  recurrence: 'None' | 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Bimonthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  recurrenceAnchor: 'completion' | 'schedule' | null;  // null = completion
  lastCompleted: string | null;
  doneDate: string | null;
  actionPoints: string | null;
  notes: string;
  domainId: string | null;
  projectId: string | null;
  blockedBy: BlockedByEntry[];   // { type: 'task', taskId } | { type: 'note', note }
  followUpDate: string | null;
  rotSince?: string | null;      // neglect clock start; null = createdAt. NOT updatedAt
  slipCount?: number | null;     // times a missed plan was moved
  recurrenceEnd?: string | null; // last date an occurrence may fall on
  completions?: string[] | null; // local days completed (survives recurring resets)
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Project
```typescript
{
  id: string;
  name: string;
  description: string;
  icon: string | null;
  status: 'Active' | 'Completed' | 'Archived';
  domainId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed: completionPercent = completedAP / totalAP (AP-weighted, default 2 AP per task)
}
```

### Domain
```typescript
{
  id: string;
  name: string;
  icon: string | null;
  priority: '1 - Critical' | '2 - Important' | '3 - Maintenance';
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Habit
```typescript
{
  id: string;
  habitName: string;
  recurrence: 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Bimonthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  lastCompleted: string | null;
  targetPerWeek: number | null;
  completionDates: string[];    // Pruned to last 90 days on each completion
  bestStreak: number | null;    // Stored, not derived: completionDates prune
  weekdays?: number[] | null;   // only these days (0=Sun); null = every day
  totalCompletions?: number | null;
  milestones?: { key: string; date: string }[] | null;
  notes: string;
  icon: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Event
```typescript
{
  id: string;
  eventName: string;
  date: string;              // YYYY-MM-DD
  time: string | null;       // HH:mm
  duration: number | null;   // minutes
  actionPoints: string | null;
  recurrence: 'None' | 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Bimonthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  recurrenceAnchor: 'completion' | 'schedule' | null;  // null = completion
  lastCompleted: string | null;
  notes: string;
  domainId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LIFEOS_DB_PATH` | No | SQLite file location (default `./data/lifeos.db`) |

## Important Patterns

### Using the Database
```typescript
// In components - use hooks (reactive)
const tasks = useTasks();
const domains = useDomains();
const habits = useHabits();
const events = useEvents();
const projects = useProjects();

// For actions
import { markTaskDone, undoTaskDone, createTask, deleteTask } from '@/lib/hooks';
import { markHabitDone, undoHabitDone, createHabit } from '@/lib/hooks';
import { createEvent, updateEventData, deleteEvent } from '@/lib/hooks';
import { createProject, updateProjectData, deleteProject } from '@/lib/hooks';
```

### Color Utilities
```typescript
// Always use shared functions from lib/colors.ts — never define inline
import { getTaskPriorityColor, getDomainPriorityColor, getStatusColor, getDueDateColor, getPriorityDotColor, getTaskPriorityBorder } from '@/lib/colors';
```

### Backups
```typescript
import { buildBackup, parseBackup, backupFilename } from '@/lib/backup-file';
// Settings downloads buildBackup(profile, payload) as JSON and restores via
// parseBackup() + replaceAllOnServer(). parseBackup rejects anything that is
// not a backup - import replaces the whole profile, so a wrong file would
// destroy the data it was meant to protect.
```

### Soft Deletes
All delete operations set `deletedAt` instead of removing records:
```typescript
// In db.ts: await db.tasks.update(id, { deletedAt: now, updatedAt: now });
// All query functions filter: .filter(t => !t.deletedAt)
// All create functions add: deletedAt: null
```

## Maintenance Instructions

When making changes to LifeOS, keep these artifacts up to date:

1. **CHANGELOG.md** — Add entries under the current version for any user-facing changes (features, fixes, UI changes). Group by category (e.g., Habits, Sync, Planning, Other).
2. **app/help/page.tsx** (How it Works) — Update if any concepts, workflows, or sync behavior changes.
3. **app/get-started/page.tsx** (Get Started) — Update if new entity types or onboarding steps are added.
4. **This file (CLAUDE.md)** — Update data models, key files, or patterns if architecture changes.

### Date Handling

**CRITICAL**: All date-only strings (YYYY-MM-DD) in this app represent **local** dates. Using UTC-based methods to produce them causes bugs in non-UTC timezones (e.g., US timezones where local date can differ from UTC date).

```typescript
// NEVER use new Date("YYYY-MM-DD") — parses as UTC midnight, wrong in US timezones
// ALWAYS use parseLocalDate for date-only strings (YYYY-MM-DD)
import { parseLocalDate, getTodayString, toDateString } from '@/lib/dates';
parseLocalDate('2026-02-04') // → local midnight Feb 4 (correct)
new Date('2026-02-04')       // → UTC midnight Feb 4 = Feb 3 in US (wrong!)

// NEVER use .toISOString().slice(0, 10) to get today's date — returns UTC date, not local
// ALWAYS use getTodayString() or toDateString(someDate) from lib/dates.ts
getTodayString()             // → local today as 'YYYY-MM-DD' (correct)
toDateString(someDate)       // → local date string from a Date object (correct)
new Date().toISOString().slice(0, 10)  // → UTC date, WRONG in US timezones!

// .toISOString() is fine for full timestamps (createdAt, updatedAt) since those
// store the exact moment in time. The bug only affects date-only strings used for
// comparison with stored local dates (plannedDate, dueDate, completionDates, etc.)
```

## Notes

- The Pi is the source of truth; the browser copy is a cache that polls every 2s
- Deletions use tombstones (`deletedAt`) so a delete is not resurrected by a
  device that had not caught up
- `taskPriority` and `urgency` are nullable on purpose: unset is what keeps a
  task in Needs Details, so never reintroduce a default on create
- Urgency = urgency field + `max(deadline, missed cycle, missed plan, neglect)` + slips.
  Only slips add; real overdue (50–70) always outranks a missed cycle (≤49) and a
  missed plan (≤44). Neglect runs from `rotSince ?? createdAt`, never `updatedAt`
- Slips are detected in `updateTaskData` (moving a plan whose date has passed)
- Recurring resets count calendar days (the daily check runs once per day)
- Energy budget for a date = per-date override → per-weekday (`ap.weekdayBudget`) →
  `suggest.settings.dailyAPBudget`. Use `useEnergySettings().budgetFor(date)`
- Back-dated completion: `markTaskDone(id, date)`, `markHabitDone(id, date)` — they
  re-record that day's history and reset a recurring task if already owed
- Push subscriptions and the sent log live in their own tables, not preferences
- Repeating tasks have a kind (`recurrenceKind`): `lapsing` (Daily / named weekdays, no due:
  missed days lapse - no cycle pressure, rot, missed plan or slips), `cycle` (from completion;
  pile up), `fixed` (schedule-anchored with a due date). Occurrences after the live one come
  from `upcomingOccurrences`; per-occurrence plans/skips live in `occurrencePlans` and are
  applied by `comeBack` when the series reaches them (cycle plans re-keyed by position)
- A day's AP only includes what is planned on it; unplanned occurrences reserve nothing
- Suggest candidates are keyed by task id or `${taskId}@${due}` for occurrences
  (`occurrenceKey`); apply with `planOccurrence`
- Tasks in a target project log `progressAmount ?? 1` to it on completion (reversed on undo)
- Blocked must have a task blocker or a followUpDate (TaskForm enforces); a due follow-up
  scores like a deadline
- Saves are field patches checked against the client's `updatedAt` (`patchRecord`, 409 on
  a stale copy); the client re-hydrates on visibility change
- Every number on the help page is asserted in `lib/scenarios.test.ts` - change both together
- `recurrenceAnchor: 'schedule'` dates the next occurrence from the previous
  `dueDate` rather than from completion, and reopens when that date passes
- Plan's calendar deliberately shows less than Week's: commitments and overdue
  work only. Week is a record and includes future deadlines and done tasks
- Task scores (importance, urgency, combined) are recalculated when priority, urgency, due date, or domain changes
- Recurring tasks have `needsReset` computed at runtime (not stored)
- `completionDates` on habits are pruned to 90 days to prevent unbounded growth
