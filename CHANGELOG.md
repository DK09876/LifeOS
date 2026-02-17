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
