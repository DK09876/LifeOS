# Changelog

All notable changes to LifeOS will be documented in this file.

## [0.5.1] - 2026-03-02

### Auto-Suggest for Planning
- Add Suggest Next Task to the unscheduled sidebar — highlights the single best task based on a multi-factor scoring algorithm (base score, deadline pressure, domain balance, effort match)
- Add Suggest Week Schedule overlay on the week calendar view — distributes unscheduled tasks across the 7-day grid using greedy bin packing, deadline tasks placed first, then flexible tasks by score
- Suggested tasks appear inline on the week view with dashed green borders
- Pin/unpin suggested tasks to lock them to a day across re-runs
- Apply All batch-schedules suggestions, Discard clears without DB changes
- Configurable scoring weights, daily AP budget, default AP, and domain focus via Settings modal
- Settings persisted to localStorage
- AP usage shown per day with over-budget highlighting
- Events AP counted against daily budget

## [0.5.0] - 2026-03-02

### Eisenhower Matrix & Urgency Scoring
- Add urgency field to tasks (Critical, High, Normal, Low, Someday) — separate from priority/importance
- Rework scoring: importance score (priority + domain), urgency score (urgency field + due date proximity), combined score (importance x urgency)
- Due date proximity now uses 10 granular tiers (overdue through 2+ months) with up to 50 points
- Add Eisenhower Matrix scatter plot in planning dashboard — plots tasks by importance (Y) vs urgency (X)
- Matrix shows four labeled quadrants: Do Now, Schedule, Fit In, Backburner
- Task dots cluster when overlapping, click to pin tooltip with task list, click task to edit
- Matrix view shares filter presets with Planning view
- Add "Due Soon" badges on unscheduled tasks in planning sidebar (e.g., "2d", "today", "overdue")

### Due Date Filters
- Add due date filter across all pages: Overdue, Due Today, This Week, Next Two Weeks, This Month, Has Due Date, No Due Date
- Add urgency filter across all pages
- Filter presets in Settings now support urgency and due date fields

### Events
- Add events system for calendar appointments and time commitments
- Add dedicated Events page with Today/Upcoming/Past sections and sidebar navigation
- Events have date, optional time/duration, action points, recurrence, domain
- Events shown on calendar (day/week/month views) alongside tasks with distinct indigo styling
- Events shown on Today page with AM/PM time formatting, labeled details (Time, Duration), and mark-done button
- Mark events done from Today page — completed events appear in "Completed Today" with undo
- Missed events (past date, not completed) appear in Triage view alongside missed tasks
- Events clickable to edit in Plan day/week views
- Recurring events auto-reset like recurring tasks
- Events included in Google Drive sync

### Sorting
- Tasks sorted alphabetically as tiebreaker when scores are equal
- Habits sorted alphabetically across all views
- Events sorted by time first, then alphabetically as tiebreaker

### Bug Fixes
- Fix timezone bug: replace all `toISOString().slice(0,10)` with `getTodayString()`/`toDateString()` — was producing UTC dates instead of local dates, causing items to not appear on correct day in US timezones
- Fix events not showing in Plan day view when no tasks are scheduled
- Fix events not appearing in Plan month view

## [0.4.1] - 2026-02-26

### Planning
- Filter presets now support multi-select — each filter field (priority, action points, domain, recurrence) can store multiple values
- Settings preset form uses checkbox groups instead of single-select dropdowns
- DB migration (v9) converts existing single-string preset filters to arrays

## [0.4.0] - 2026-02-18

### Toast Notifications
- Add toast notification system with auto-dismiss (success, error, info)
- Replace inline status messages with toast notifications for Push/Pull/Sign-in feedback
- All CRUD operations (create, update, delete) now show error toasts on failure

### Form & Modal Improvements
- Add loading states to task, habit, and domain forms — prevents double-click duplicates
- Add focus trap to modals — Tab key cycles through focusable elements within the dialog
- Add `role="dialog"`, `aria-modal`, and `aria-labelledby` to Modal component

### Accessibility
- Add ARIA labels to all icon-only buttons (check circles, delete, undo, navigation arrows, sidebar collapse, hamburger menu)
- Fix hover-only visibility on action buttons — now also visible on keyboard focus via `group-focus-within`
- Add `aria-label` to push/pull buttons for screen readers

### Mobile Responsive
- Add mobile sidebar as overlay drawer with hamburger menu button
- Sidebar hidden on small screens, shown as fixed sidebar on desktop
- Today stats grid stacks on mobile (`grid-cols-1` → `sm:grid-cols-3`)
- Plan page unscheduled panel stacks above calendar on mobile (`flex-col` → `lg:flex-row`)
- Header adapts for small screens — quote hidden on mobile, email hidden until lg breakpoint
- Reduce page padding on mobile

### Bug Fixes
- Fix `getStartOfWeek` returning UTC date string — now uses `toDateString()` for correct local date
- Fix `undoHabitDone` parsing completion date as UTC midnight — now uses noon to avoid timezone shift
- Fix `useDomain` counting soft-deleted tasks in domain task count
- Fix concurrent Push/Pull operations — module-level guard prevents overlapping sync
- Fix "How it Works" page describing non-existent "Needs Reset" triage — now accurately describes automatic reset
- Fix Plan page date display using UTC midnight for due dates in unscheduled task cards

### UX Improvements
- Filter presets in planning view now toggle off when clicked while active
- Month view "+more" indicator is now clickable — navigates to day view
- Settings preset deletion now requires confirmation dialog
- Today page "+ Add Task" pre-fills today's planned date
- Empty state for domains card view when no domains exist or match filters

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
