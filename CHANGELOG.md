# Changelog

All notable changes to LifeOS will be documented in this file.

## [0.3.0] - In Progress

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
