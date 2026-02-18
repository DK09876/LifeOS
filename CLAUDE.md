# CLAUDE.md

This file provides context for Claude Code when working on this repository.

## Project Overview

LifeOS is a **local-first Progressive Web App (PWA)** for personal productivity — tasks, habits, and planning. It stores data locally using IndexedDB and backs up to the user's personal Google Drive via explicit Push/Pull.

**Key Principle**: No central server database - each user owns their data completely.

## Architecture

```
User's Device                          User's Google Drive
┌─────────────────┐                   ┌─────────────────┐
│  React UI       │                   │ LifeOS/         │
│       ↓↑        │  Push ──────────→ │   lifeos-data.json
│  IndexedDB      │  ←────────── Pull │   (version: 2)  │
│  (Dexie.js)     │                   │                 │
└─────────────────┘                   └─────────────────┘
```

### Data Flow
1. User makes changes → saved to IndexedDB immediately
2. **Push**: uploads local data to Google Drive (replaces remote)
3. **Pull**: downloads remote data and replaces local (with unsaved-changes warning)
4. No auto-sync — user controls when data moves

### Deletion Model
- Records get `deletedAt` timestamp (soft delete / tombstone) instead of being removed
- Tombstones propagate deletions across devices: push on Device A → pull on Device B
- Tombstones older than 30 days are compacted (hard-deleted) before each push

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React 19 + Tailwind CSS 4
- **Local Database**: Dexie.js (IndexedDB wrapper), schema version 8
- **Auth**: Google OAuth 2.0 (popup with callback page + localStorage events)
- **Sync**: Google Drive API (REST) — Push/Pull only, no auto-sync
- **Date Handling**: date-fns

## Key Files

| File | Purpose |
|------|---------|
| `lib/db.ts` | Dexie database schema, CRUD operations, score calculation, sync payload types |
| `lib/hooks.ts` | React hooks: `useTasks()`, `useDomains()`, `useHabits()`, action functions |
| `lib/sync.ts` | Google Drive Push/Pull: `pushToGoogleDrive()`, `pullFromGoogleDrive()` |
| `lib/colors.ts` | Shared color utility functions (priority, status, due date colors) |
| `lib/google-auth.ts` | Google OAuth: sign in, sign out, token management |
| `components/AppLayout.tsx` | Main layout: sidebar, header with Push/Pull buttons, quote |
| `app/page.tsx` | Today view: due tasks + habits, completed today |
| `app/plan/page.tsx` | Triage + Planning with drag-and-drop calendar |
| `app/habits/page.tsx` | Habits management: due now, on track, paused |

## Data Models

All models include `deletedAt: string | null` for tombstone-based soft deletes.

### Task
```typescript
{
  id: string;
  taskName: string;
  status: 'Needs Details' | 'Backlog' | 'Planned' | 'Blocked' | 'Done' | 'Archived';
  taskPriority: '1 - Urgent' | '2 - High' | '3 - Normal' | '4 - Low' | '5 - Optional';
  taskScore: number;
  dueDate: string | null;
  plannedDate: string | null;
  recurrence: 'None' | 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Bimonthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  lastCompleted: string | null;
  doneDate: string | null;
  actionPoints: string | null;
  notes: string;
  domainId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  notes: string;
  icon: string | null;
  isActive: boolean;
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
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | No | Google OAuth Client ID (only needed for sync) |

## Important Patterns

### Using the Database
```typescript
// In components - use hooks (reactive)
const tasks = useTasks();
const domains = useDomains();
const habits = useHabits();

// For actions
import { markTaskDone, undoTaskDone, createTask, deleteTask } from '@/lib/hooks';
import { markHabitDone, undoHabitDone, createHabit } from '@/lib/hooks';
```

### Color Utilities
```typescript
// Always use shared functions from lib/colors.ts — never define inline
import { getTaskPriorityColor, getDomainPriorityColor, getStatusColor, getDueDateColor, getPriorityDotColor, getTaskPriorityBorder } from '@/lib/colors';
```

### Sync Flow
```typescript
import { pushToGoogleDrive, pullFromGoogleDrive } from '@/lib/sync';
// Push: compacts tombstones, exports all data (v2 payload), uploads to Drive
// Pull: downloads from Drive, replaces all local data
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
```typescript
// NEVER use new Date("YYYY-MM-DD") — parses as UTC midnight, wrong in US timezones
// ALWAYS use parseLocalDate for date-only strings (YYYY-MM-DD)
import { parseLocalDate, getTodayString, toDateString } from '@/lib/dates';
parseLocalDate('2026-02-04') // → local midnight Feb 4 (correct)
new Date('2026-02-04')       // → UTC midnight Feb 4 = Feb 3 in US (wrong!)
```

## Notes

- The app works fully offline without Google sign-in
- Google Drive sync is optional — Push/Pull only, no auto-sync
- Deletions use tombstones (`deletedAt`) that propagate across devices via sync
- Task scores are recalculated when priority or domain changes
- Recurring tasks have `needsReset` computed at runtime (not stored)
- `completionDates` on habits are pruned to 90 days to prevent unbounded growth
