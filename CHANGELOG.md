# Changelog

All notable changes to LifeOS will be documented in this file.

## [0.3.0] - 2026-02-17

### Habits
- Add habits system with recurrence tracking (Daily, Weekly, Monthly, etc.)
- Add habits page with create/edit/delete, completion tracking, and weekly progress
- Integrate habits into Today view — due habits appear above tasks, completed habits in "Completed Today"
- Add undo for habit and task completions on Today page
- Add habits link to sidebar

### Multi-Select Filters
- Upgrade all filter controls from single-select dropdowns to multi-select checkboxes
- Filters now support selecting multiple values simultaneously (e.g. multiple priorities)
- Migrate persisted filter state from string values to arrays with backward compatibility

### Google Drive Sync — Tombstones & Full Data Export
- Add tombstone-based soft deletes (`deletedAt` field) to tasks, domains, habits, and filter presets
- Deleting on one device now propagates to other devices via sync
- Replace two-way "Sync" with explicit "Pull" and "Push" buttons (header + settings)
- Remove auto-sync on mount and after sign-in — user controls when data moves
- Export now includes filter presets and localStorage preferences (`version: 2` payload)
- Pull performs full replace of local data from remote (with unsaved-changes warning)
- Push compacts tombstones older than 30 days before uploading
- Add `hasUnsavedChanges()` check before pull to warn about local modifications
- Add `userinfo.email` and `userinfo.profile` OAuth scopes for user profile display
- Fix `clearAllData()` to also clear filter presets table

### Google OAuth
- Replace GIS popup auth with callback popup + localStorage events (fixes HTTPS sign-in)
- Add `oauth2callback.html` static callback page for cross-origin token delivery
- Automatic fallback to full-page redirect when popups are blocked (mobile support)

### Bug Fixes
- Fix timezone bug in due date coloring — dates parsed as UTC midnight showed wrong day in US timezones
- Fix timezone bug in date display across Tasks, Today, and Plan pages (use `parseLocalDate`)
- Fix "Completed Today" section using `updatedAt` instead of `doneDate` — edited tasks no longer falsely appear
- Fix `undoTaskDone` losing previous status — incomplete tasks now correctly return to "Needs Details"
- Fix month view priority colors — broken string replace caused Optional priority tasks to have no background color
- Fix day view inline priority border — missing `5 - Optional` case, now uses shared `getTaskPriorityBorder` utility
- Fix token expiry not reflected in UI — expired sessions now clear user state and show yellow "Session expired" message
- Fix task score calculation using UTC date parse for due date proximity

### Code Quality
- Extract shared color utilities to `lib/colors.ts` (removes duplication across 5 pages)
- Fix domains card delete button not appearing on hover (missing `group` class)
- Replace `window.confirm` with styled `ConfirmDialog` component for Pull warnings
- Remove dead components (`TaskCard.tsx`, `DomainCard.tsx`) and unused imports
- Remove unused `activePresetId` state from Plan page
- Add `pruneCompletionDates()` to limit habit completion history to 90 days
- Update CLAUDE.md with current architecture, data models, and maintenance instructions
- Update "How it Works" page: add Habits section, fix sync docs (Push/Pull, not merge)
- Update "Get Started" page: add habits step, update step count to 5

### Other
- Add drag-and-drop calendar scheduling in planning dashboard
- Split planning into separate Triage and Planning views with week calendar
- Add due date column with proximity highlighting (red=overdue, orange=today, yellow=soon)
- Add configurable filters to planning view (same as tasks)
- Add Day/Week/Month calendar view toggle
- Add "Missed" section in Triage for tasks with past planned dates
- Add "Overdue" section in Triage for tasks past their due date
- Add `doneDate` field to tasks (auto-set when marked done)
- Switch to curated productivity quotes (external APIs unreliable)
- Add configurable filter presets in Settings (stored in IndexedDB)
- Filter presets can be shown/hidden, edited, and custom presets can be added
- Add manual recurrence check trigger in Settings with status display

## [0.2.0] - 2025-01-28

- Add automatic daily reset for recurring tasks
- Add filter, sort, and column controls to tasks and domains pages
- Add collapsible sidebar and action points indicator
- Add new recurrence options (Bimonthly, Half-Yearly)

## [0.1.0] - 2025-01-22

- Initial release with local-first architecture
- Task management with priorities, statuses, and scoring
- Domain organization with priority levels
- PWA support for offline use and installation
- Daily inspirational quotes
