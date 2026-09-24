# Changelog

All notable changes to LifeOS will be documented in this file.

## [0.9.0] - 2026-09-24

### Time pressure that means what it says
- Rot is measured from when a task was written (or unblocked, or last came round), not from its last edit. Renaming a task or sliding its plan to tomorrow used to make it look freshly cared for
- Moving a plan whose day has gone counts as a **slip**, and each slip adds pressure. A plan you keep sliding gets louder instead of quietly resetting
- A **missed plan** now carries its own pressure, above plain neglect and below a real overdue deadline — you had decided it mattered
- **Missed recurring cycles pile up**: every whole cycle gone by adds more. It stays below any real overdue deadline, which always wins
- Fixed: after a recurring task came back, its cycle was counted from when the task was first written, so undated recurring tasks came back already overdue

### Recurrence
- Fixed: a daily task finished late in the evening did not come back the next day. The reset counted 24 elapsed hours but only ran once, on the first visit of the day. Resets now count calendar days
- **Repeat until**: a recurring task can stop after a date — for repeating work with an end in mind
- **↻ next on**: recurring tasks show when they come round again
- Later occurrences of recurring tasks show faintly on Week and Plan, and earlier completions stay ticked on Week. Each task keeps a log of the days it was done, so recurring completions no longer vanish from history when the task comes back
- Recurring events move on to their next occurrence once the current one has passed, attended or not

### Today and Plan
- Today stays a dashboard: one collapsed **Worth a look** line holds blocked work with a close deadline, captures left without details through a weekend, and yesterday's unticked items
- Blocked tasks no longer appear on Today's list; blocked work with a deadline within a week is flagged as **pressing** instead
- Plan has an attention bar that jumps into the right Triage tab; overdue work is pinned in red at the top of Unscheduled; recurring tasks behind on their cycle say how far behind
- The Triage count no longer counts a task twice when it is both missed and overdue
- Top priority is labelled **Essential** — priority is how much it matters; "urgent" is urgency's job

### Planning and energy
- Suggest can plan **next week** as well as this one, and has **Accept all** alongside applying pinned suggestions
- Suggest places deadline work on the **earliest day with room**, not the deadline day itself; overdue work and missed plans go on the first day with room
- Missed plans are offered again instead of being skipped for having a date
- Suggest uses each day's own budget and reserves effort for recurring tasks' later occurrences, alongside habits
- **Daily energy** in Settings: one default, optionally different per weekday, with a one-tap "use what I actually spend"

### Yesterday
- A new **Yesterday** page for ticking off what you forgot: tasks, habits, events and goal progress. Anything marked there counts on yesterday — in history, review, streaks and recurrence

### Habits and goals
- Habits can be limited to **chosen weekdays**; they only show and are only budgeted on those days
- **Milestones** — streaks of 3, 7, 30, 100 days and totals of 10, 100, 500 — celebrated once, with a lifetime count and the next ones shown on each card
- Goal projects can have a **finish by** date, showing the pace needed and whether you are ahead or behind. It never nags

### Review
- Retrospect is now **Review**, with Week and Month views: energy by day, backlog trend, effort by domain (and quiet domains), what slipped, habits against expectation, milestones, project movement and everything finished — compared with the period before
- History is recorded before recurring tasks reset, and back-filled for the last week if the app was not opened

### Notifications
- A 🔔 in the top bar lists what needs you right now
- **Push notifications** from the Pi to phone and laptop: one morning brief, event reminders, an evening habit check and the weekly/monthly review. Set times and which ones you get in Settings. On iPhone, add LifeOS to the Home Screen first

### Notes & Lists
- A place for shopping lists and things to remember, kept out of the backlog. The voice assistant can add to a list, read it back, or save a note

## [0.8.0] - 2026-09-23

### Projects have two shapes
- A project is now either a **pile of work** (tasks, done when they are all done — the old behaviour) or a **goal you count towards** (a target you log against)
- A goal pursued by a daily recurring task used to show 0%, jump to 100% the moment the task was ticked, and fall back to 0% at the next rollover — it measured the state of a task row rather than work done, so fifty pages read left it where it started. A target project counts what you log, in its own unit, and nothing can take it away
- Logging is deliberately uncoupled from tasks and habits: you did some amount of the thing and you say so. Days with something logged form a streak, and today's entry can be undone

### Planning
- The planner reserves what habits will cost before offering anything to tasks. It used to ignore them entirely, so it offered a whole budget on a day that already had a gym session in it — and Today's meter counted habits while the planner did not, so the two pages disagreed about the same day
- The reservation is named in the day footer rather than silently deducted, so a day that looks empty because the gym claimed it says so
- You can choose which days to plan into. Filling Monday on a Thursday is not a plan, so it defaults to the rest of the week
- Four normalised weight sliders are replaced by named styles — balanced, deadline-driven, quick wins, big rocks — with the sliders kept under Custom. Nobody can say what "domain balance 0.15" ought to be

## [0.7.0] - 2026-09-17

### Dates and recurrence
- Fixed completed tasks being recorded a day early. `doneDate` has two writers — the web app stores a timestamp, the voice assistant a plain date — and the date-only form was being read as UTC midnight, which is the previous evening in any western timezone. Anything completed by voice never reached today's count
- Recurring tasks now roll their dates forward when they reset, anchored on when you completed them and preserving the gap between planned and due. Previously only the status reset, so a weekly task came back Planned for a day that had already passed and sat in Triage permanently
- Recurring events roll forward too, anchored on the event's own date so a standing Monday meeting marked done late does not drift a day each week

### Scoring
- A repeating task with no due date is now due by the end of its own cycle. "Every two weeks" already says when it is due, but the interval only decided when the task came back, never whether it was late — so plants a fortnight past their watering registered no pressure at all. An explicit due date still wins, since that is a statement rather than an inference
- Domain priority now contributes 5/10/15 instead of 10/20/30. It used to swing 20 points across a priority range of only 40 — half the signal — so booking a dentist appointment came out as important as filing a tax return, and anything in a Maintenance domain was capped below both. Aspirational work lives in exactly those domains, because people mark them Maintenance for not being urgent day to day, so the thing that mattered most could never rise. Importance now ranges 15–65 and the matrix threshold moves to 45
- Overdue now escalates instead of flattening: +50 the first day late rising to +70 beyond a month. A task one day late and one three months late used to score identically
- Tasks accrue pressure from neglect (+5 after two weeks untouched, up to +20 after three months) whether or not they have a due date — a deadline three months out does not make a task ignored for three months calm
- A planned date that has not passed stops neglect accruing: committing to a day is the answer to "when", and the pressure was only ever about not having one. Miss the day and it resumes
- Deadline pressure and neglect are never added — a task takes whichever is louder, so a plan cannot mask a deadline and lateness always wins
- Urgency now ranges 10–120. The Eisenhower Matrix thresholds moved with it (importance 60, urgency 65); previously nine of fifteen priority/domain combinations cleared the importance line and no undated task could ever cross the urgency one, leaving "Fit In" structurally empty

### Recurrence
- A Weekly task can name the days it lands on — weekdays only, or Mon/Wed/Fri. It then comes back on the next of those days rather than seven days after you last happened to do it, which is what "every weekday" actually means
- Recurring tasks can now keep a fixed period instead of counting from completion. "When I finish it" suits anything you do every so often; "the due date" suits a fortnightly return or a monthly bill, where doing it early must not drag every future deadline earlier, and where the next period should open as soon as the last one closes

### Tasks
- Priority and urgency can now be left unset, and both are required before a task promotes out of Needs Details. Previously priority was checked but defaulted to Normal so could never be empty, and urgency was not checked at all — in practice only domain and action points gated promotion
- Level badges, sorting and filtering all understand an unset value

### Effort
- Habits now carry an effort estimate and count against the day's budget. They are a third of most days and used to cost nothing at all, which made the meter quietly optimistic
- Action points now mean something specific. The scale ran "Low" to "High" with nothing in between, so one person's 1 was brushing their teeth and another's was an hour at the gym. Each rung now names what it covers, and 0 is a real answer for anything worth keeping but not worth budgeting for
- Expect to re-baseline your daily budget once habits are counted — on the review data it went from 7 AP of tasks to 17 AP once three habits were included

### Blocked work
- Blocked tasks are now parked: they stop accruing neglect and come off every calendar. Waiting on someone else is not neglect, and scoring it as rot pushed work nobody could act on up a list it was invisible on
- They take a follow-up date instead. Until then they stay quiet; on the day, Today asks whether to chase, defer or unblock

### Retrospect
- New page. The day meter was a snapshot that evaporated at midnight, so the app could tell you today was full but never that you are always full
- Shows the last four weeks as bars against the budget you had set each day, what you average versus what you allow yourself, how many days ran over, and what you finished
- Habit streaks and the 30-day strips live here too
- Days are written up on the first visit of the following morning, which is the first moment a day is finished and safe to total

### Today
- Added a day effort meter: capacity, what you have used, and what is still planned. Capacity starts from your Plan budget and can be adjusted for a single day
- Added a strip for plans whose day has passed, with per-item actions (today, tomorrow, unplan, done) rather than dumping them into today's list. Overdue deadlines stay in Plan

### Calendars
- Plan's calendar shows commitments and anything past its date; a future deadline you have not scheduled stays in Unscheduled rather than making the week look booked. The Week view, which is a record rather than a plan, still shows everything
- A task now appears on exactly one day: its planned date, or its due date when unplanned. Unplanned deadlines are drawn dashed and chipped so a deadline reads differently from a commitment. Previously a planned task was drawn twice and the Week and Plan calendars disagreed about the same week
- Finished tasks stay on the Week view, greyed out, instead of disappearing
- The Week counter no longer calls due-dated tasks "planned"

### Mobile
- Fixed the keyboard dropping every couple of seconds while typing in any dialog. The modal re-focused itself on every render, and it re-rendered on every poll, so focus was pulled off the field you were in twice a second. On a desktop that is an invisible flicker; on a phone the keyboard goes with it
- Polls no longer look like changes. The server stamps every read with the time it was read, so the "has anything moved" comparison found a difference every single time and re-rendered the whole app twice a second. It now compares content and ignores the timestamp
- Pressing return in a text field no longer submits the form. On a phone the return key is the only obvious way to dismiss the keyboard, so typing a name and reaching for it saved a half-filled record and shut the dialog — which reads as the form closing by itself. Return now just leaves the field, and nothing is saved until you press the button
- A toast no longer swallows taps aimed at what is underneath it. At phone width it sits exactly over a dialog's Create and Save buttons, so while the monthly backup reminder was on screen those buttons did nothing. Its own buttons still work

### Habits
- The frequency picker now says what the option you picked actually does. It described both modes with the same sentence — "a fixed schedule (e.g., every day, every week)" — which restates the label rather than answering the question it raises. A weekly quota in particular was not obvious until you had watched one for a week
- Weekly is now described honestly as "a week after you last did it", not "every week", which reads as a set weekday

### Habits (earlier)
- Fixed habits appearing as due and completed at the same time. A weekly target made the already-done-today check unreachable
- Added streaks and a 30-day history strip. The streak unit follows the habit — days for a plain habit, target-hitting weeks for one with a weekly target, which also shows its consecutive-day run alongside
- Best streak is stored rather than derived, so it does not shrink as completion history ages out

### Data
- Added backup download and restore in Settings. The app had been asking people to copy data off the Pi while offering no way to do it
- The backup reminder no longer fires on an empty profile

### Docs
- Pulled `docs/architecture.md` in from the feature branch where it was stranded, repaired its mangled em dashes, and brought its backup section up to date
- Fixed the same double-encoded characters in pantry's README and architecture doc

### Other
- The task form now shows five fields and hides the rest behind "More options". A task is usually a name, how much it matters, where it belongs and what it costs; putting eleven fields in front of that made writing one down feel like filing a form. The section opens by itself when editing a task that already uses it, and the toggle shows how many optional fields are in play
- Added a global quick-add: the + button in the top bar, or pressing `n` from any page
- The daily AP budget and suggester settings now live on the server against your profile instead of in browser storage, so they follow you between devices and are included in backups
- Fixed the "+ Add" buttons on both calendars being invisible until hovered exactly
- Made Today, Week, Plan and Tasks usable at phone width

## [0.6.0] - 2026-03-02

### Blocked-by Tasks
- Tasks can now be blocked by specific other tasks or freeform notes instead of using a manual "Blocked" status
- Adding a blocker auto-sets status to Blocked; when all blockers are resolved, the task auto-unblocks
- Task-type blockers are auto-removed when the blocking task is completed, deleted, or archived
- Note-type blockers must be manually removed
- Circular dependency prevention: cannot add a blocker that would create a cycle
- Triage Blocked section now shows specific blocker details inline (task names and notes)

### Projects
- Add projects system for grouping related tasks with AP-weighted completion tracking
- Projects have name, description, icon (emoji), status (Active/Completed/Archived), and optional domain
- Progress bar shows completion percentage based on action points (completedAP / totalAP)
- Tasks without AP set use default of 2 AP for progress calculation
- Dedicated /projects page with project cards, expandable task lists, filters by status and domain
- Create tasks directly within a project from the expanded view
- Project dropdown added to task form for assigning tasks to projects
- Projects link added to sidebar navigation between Tasks and Events
- Project filter added to Tasks page and Plan page filter controls
- Projects included in Google Drive sync (backward compatible — optional field)

### Database
- Schema upgraded to version 11: adds `projects` table, `blockedBy` and `projectId` fields on tasks

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
