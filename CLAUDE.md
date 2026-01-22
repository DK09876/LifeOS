# CLAUDE.md

This file provides context for Claude Code when working on this repository.

## Project Overview

LifeOS is a **local-first Progressive Web App (PWA)** for personal productivity and task management. It stores data locally on each device using IndexedDB and syncs across devices via the user's personal Google Drive.

**Key Principle**: No central server database - each user owns their data completely.

## Architecture

```
User's Device                          User's Google Drive
┌─────────────────┐                   ┌─────────────────┐
│  React UI       │                   │ LifeOS/         │
│       ↓↑        │                   │   lifeos-data.json
│  IndexedDB      │ ←───── sync ────→ │                 │
│  (Dexie.js)     │                   │                 │
└─────────────────┘                   └─────────────────┘
```

### Data Flow
1. User makes changes → saved to IndexedDB immediately
2. On sync (auto on startup, or manual button) → merge with Google Drive
3. Conflict resolution: last-write-wins based on `updatedAt` timestamps

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React 19 + Tailwind CSS 4
- **Local Database**: Dexie.js (IndexedDB wrapper)
- **Auth**: Google Identity Services (OAuth 2.0)
- **Sync**: Google Drive API (REST)
- **Date Handling**: date-fns

## Key Files

| File | Purpose |
|------|---------|
| `lib/db.ts` | Dexie database schema, CRUD operations, score calculation |
| `lib/hooks.ts` | React hooks: `useTasks()`, `useDomains()`, action functions |
| `lib/google-auth.ts` | Google OAuth: sign in, sign out, token management |
| `lib/sync.ts` | Google Drive sync: upload, download, merge |
| `app/page.tsx` | Main UI with task/domain lists, filters, sync controls |
| `public/sw.js` | Service worker for offline caching |
| `public/manifest.json` | PWA manifest for installability |

## Data Models

### Task
```typescript
{
  id: string;                    // UUID
  taskName: string;
  status: 'Needs Details' | 'Backlog' | 'Blocked' | 'Done' | 'Archived';
  taskPriority: '1 - Urgent' | '2 - High' | '3 - Normal' | '4 - Low' | '5 - Optional';
  taskScore: number;             // Calculated from priority + domain + due date
  dueDate: string | null;        // ISO date
  plannedDate: string | null;
  recurrence: 'None' | 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  lastCompleted: string | null;  // For recurring task reset detection
  actionPoints: string | null;
  notes: string;
  domainId: string | null;       // FK to Domain
  createdAt: string;
  updatedAt: string;             // Used for sync conflict resolution
}
```

### Domain
```typescript
{
  id: string;
  name: string;
  priority: '1 - Critical' | '2 - Important' | '3 - Maintenance';
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

## PWA Features

- **Installable**: Works on iOS, Android, Windows, macOS
- **Offline**: Service worker caches app shell, IndexedDB stores data
- **Sync**: Manual sync button + auto-sync on app startup

## Important Patterns

### Using the Database
```typescript
// In components - use hooks (reactive)
const tasks = useTasks();
const domains = useDomains();

// For actions
import { markTaskDone, undoTaskDone, resetTask, createTask } from '@/lib/hooks';
```

### Direct DB Access (in lib files)
```typescript
import { db, getAllTasks, createTask, updateTask } from '@/lib/db';
```

### Sync Flow
```typescript
import { syncWithGoogleDrive } from '@/lib/sync';
const result = await syncWithGoogleDrive();
// result: { success: boolean, message: string, lastSyncedAt?: string }
```

## Notes

- The app works fully offline without Google sign-in
- Google Drive sync is optional - for cross-device use only
- All data merging uses timestamps (`updatedAt`) for conflict resolution
- Task scores are recalculated when priority or domain changes
- Recurring tasks have `needsReset` computed at runtime (not stored)
