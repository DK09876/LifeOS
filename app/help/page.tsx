'use client';

import { useState } from 'react';

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--card-hover)] transition-colors"
      >
        <span className="text-sm text-[var(--muted)]">{title}</span>
        <span className="text-[var(--muted)] text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-4 border-t border-[var(--border-color)]">{children}</div>}
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">How it Works</h1>
        <p className="text-[var(--muted)]">Everything you need to know about LifeOS</p>
      </div>

      <div className="space-y-8">
        {/* Overview */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-3">What is LifeOS?</h2>
          <p className="text-sm text-[var(--muted)] mb-3">
            LifeOS is a personal productivity app for managing tasks, habits, events, and projects. All your data lives on your device — nothing is sent to a server. You can optionally back up to your personal Google Drive.
          </p>
          <p className="text-sm text-[var(--muted)]">
            The core idea: capture everything, organize it into domains and projects, plan your week, and work from your Today view.
          </p>
        </section>

        {/* Pages */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Pages</h2>
          <div className="space-y-4 text-sm">
            <div className="flex gap-4">
              <span className="text-xl w-8 flex-shrink-0">📍</span>
              <div>
                <p className="text-white font-medium">Today</p>
                <p className="text-[var(--muted)]">Your daily dashboard. Shows habits due today, today's events, and tasks planned or due today. Mark items complete with one click. Completed items move to a collapsible "Completed Today" section where you can undo them.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8 flex-shrink-0">📅</span>
              <div>
                <p className="text-white font-medium">Week</p>
                <p className="text-[var(--muted)]">A 7-day calendar (Mon–Sun). See tasks and events for each day. Navigate between weeks. Hover over a day to add tasks directly to it. Drag tasks between days to reschedule.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8 flex-shrink-0">📋</span>
              <div>
                <p className="text-white font-medium">Plan</p>
                <p className="text-[var(--muted)]">Your planning hub with three views:</p>
                <ul className="text-[var(--muted)] list-disc ml-4 mt-1 space-y-1">
                  <li><span className="text-white">Triage</span> — Review tasks that need attention: incomplete details, blocked tasks (with blocker info shown inline), missed planned dates, overdue due dates, and archived items.</li>
                  <li><span className="text-white">Planning</span> — Drag unscheduled tasks onto a Day/Week/Month calendar. Filter and sort tasks. Use filter presets for quick views. Auto-suggest can recommend your next task or schedule your whole week.</li>
                  <li><span className="text-white">Matrix</span> — Eisenhower scatter plot showing tasks by importance vs. urgency. Click dots to see task names, click a task to edit it.</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8 flex-shrink-0">📁</span>
              <div>
                <p className="text-white font-medium">Tasks</p>
                <p className="text-[var(--muted)]">Full database of all tasks. Search, filter by status/priority/urgency/domain/project/due date, toggle column visibility, and multi-level sort. Click any row to edit.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8 flex-shrink-0">📦</span>
              <div>
                <p className="text-white font-medium">Projects</p>
                <p className="text-[var(--muted)]">Group related tasks into projects. Each project shows a progress bar based on completed action points. Expand a project to see its tasks, or create new tasks within it. Assign existing tasks to projects by editing the task and selecting a project.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8 flex-shrink-0">🕐</span>
              <div>
                <p className="text-white font-medium">Events</p>
                <p className="text-[var(--muted)]">Calendar appointments and time commitments. Events have a date, optional time and duration, and show on Today, Week, and Plan calendars with distinct indigo styling. Events can recur and have action points.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8 flex-shrink-0">🔄</span>
              <div>
                <p className="text-white font-medium">Habits</p>
                <p className="text-[var(--muted)]">Track recurring habits. Set a fixed schedule (daily, weekly, etc.) or a "X times per week" target. Due habits appear on the Today page. The Habits page groups them into Due Now, On Track, and Paused.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8 flex-shrink-0">🗂️</span>
              <div>
                <p className="text-white font-medium">Domains</p>
                <p className="text-[var(--muted)]">Life areas like Work, Health, Finance. Each domain has a priority level that affects how tasks are scored. View as cards or a table. Assign tasks and projects to domains to organize everything.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8 flex-shrink-0">⚙️</span>
              <div>
                <p className="text-white font-medium">Settings</p>
                <p className="text-[var(--muted)]">Configure filter presets for quick planning views, run recurring task resets manually, manage Google Drive push/pull, and toggle the Get Started page.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Tasks */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Tasks</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>Tasks are the core of LifeOS. Each task has:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li><span className="text-white">Name</span> — what you need to do</li>
              <li><span className="text-white">Status</span> — where the task is in its lifecycle (see below)</li>
              <li><span className="text-white">Priority</span> — how important it is (Urgent to Optional)</li>
              <li><span className="text-white">Urgency</span> — how time-sensitive it is (Critical to Someday)</li>
              <li><span className="text-white">Domain</span> — which life area it belongs to</li>
              <li><span className="text-white">Project</span> — which project it's part of (optional)</li>
              <li><span className="text-white">Due Date</span> — when it must be done by</li>
              <li><span className="text-white">Planned Date</span> — when you plan to work on it</li>
              <li><span className="text-white">Recurrence</span> — repeating schedule (daily, weekly, etc.)</li>
              <li><span className="text-white">Action Points (AP)</span> — effort estimate from 1 (low) to 5 (high)</li>
              <li><span className="text-white">Blocked By</span> — other tasks or notes that are blocking this task</li>
              <li><span className="text-white">Notes</span> — any additional context</li>
            </ul>
          </div>
        </section>

        {/* Task Statuses */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Task Statuses</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs flex-shrink-0 mt-0.5">Needs Details</span>
              <p className="text-[var(--muted)]">Task is missing required info (name, priority, domain, or action points). Fill these in and it automatically promotes to Backlog or Planned.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs flex-shrink-0 mt-0.5">Backlog</span>
              <p className="text-[var(--muted)]">Ready to work on but not yet scheduled. Assign a planned date to promote to Planned.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs flex-shrink-0 mt-0.5">Planned</span>
              <p className="text-[var(--muted)]">Scheduled for a specific date. Automatically set when you assign a planned date.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="px-2 py-1 rounded bg-gray-500/20 text-gray-400 text-xs flex-shrink-0 mt-0.5">Blocked</span>
              <p className="text-[var(--muted)]">Waiting on something. Add specific blockers — other tasks or freeform notes. When all blocking tasks are completed or deleted, the task auto-unblocks. Note blockers must be removed manually.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs flex-shrink-0 mt-0.5">Done</span>
              <p className="text-[var(--muted)]">Completed. Hidden from active views. Recurring tasks auto-reset back to Backlog when their interval passes.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="px-2 py-1 rounded bg-gray-600/20 text-gray-500 text-xs flex-shrink-0 mt-0.5">Archived</span>
              <p className="text-[var(--muted)]">No longer relevant. Hidden everywhere except the Tasks page and Triage.</p>
            </div>
          </div>

          <Collapsible title="How auto-status works">
            <div className="space-y-2 text-sm text-[var(--muted)] pt-3">
              <p>LifeOS automatically adjusts status based on your task's fields:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>A task missing name, priority, domain, or AP stays at <span className="text-yellow-400">Needs Details</span></li>
                <li>Once all fields are filled, it promotes to <span className="text-blue-400">Backlog</span></li>
                <li>If a planned date is set, it promotes to <span className="text-purple-400">Planned</span>. Remove the date and it drops back to Backlog.</li>
                <li>Setting status to <span className="text-gray-400">Blocked</span> (or adding a blocker) and <span className="text-green-400">Done</span>/<span className="text-gray-500">Archived</span> are always manual — auto-status never overrides these.</li>
              </ul>
            </div>
          </Collapsible>
        </section>

        {/* Blocked By */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Blocked-by Tasks</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>When you set a task's status to Blocked, a "Blocked By" section appears in the form. You can add two types of blockers:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li><span className="text-white">Task blockers</span> — select another task. When that task is marked Done, deleted, or archived, the blocker is automatically removed.</li>
              <li><span className="text-white">Note blockers</span> — freeform text for anything not tracked as a task (e.g., "waiting for client reply"). You must remove these manually.</li>
            </ul>
            <p>When all blockers are resolved, the task auto-unblocks and returns to Backlog or Planned. In the Plan triage view, blocked tasks show their specific blockers inline so you can see at a glance what's holding things up.</p>
          </div>
        </section>

        {/* Projects */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Projects</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>Projects group related tasks together. Each project has a name, optional icon and description, a status (Active, Completed, Archived), and an optional domain.</p>
            <p><span className="text-white">Progress tracking:</span> The progress bar shows completion based on action points, not just task count. A project with five 1-AP tasks done and one 5-AP task remaining would show 50%, not 83%.</p>
            <p><span className="text-white">Assigning tasks:</span> To add existing tasks to a project, edit the task and select a project from the dropdown. You can also create new tasks directly from a project's expanded view.</p>
            <p><span className="text-white">Filtering:</span> The Tasks page and Plan page both have a Project filter so you can focus on one project at a time.</p>
          </div>

          <Collapsible title="How progress is calculated">
            <div className="space-y-2 text-sm text-[var(--muted)] pt-3">
              <p className="font-mono text-white">completionPercent = completedAP / totalAP x 100</p>
              <p>Only non-deleted tasks count. Tasks without AP set use a default of 2 AP. A task is "completed" if its status is Done or Archived.</p>
            </div>
          </Collapsible>
        </section>

        {/* Events */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Events</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>Events are calendar appointments and time commitments — separate from tasks. They represent things that happen at a specific date and time.</p>
            <ul className="list-disc ml-4 space-y-1">
              <li><span className="text-white">Date & Time:</span> Always have a date. Optionally set a time (shown as AM/PM) and duration in minutes.</li>
              <li><span className="text-white">Action Points:</span> Optionally estimate effort, just like tasks. Event AP counts against your daily budget in auto-suggest.</li>
              <li><span className="text-white">Recurrence:</span> Events can recur on the same schedules as tasks. Recurring events auto-reset when their interval passes.</li>
              <li><span className="text-white">Where they appear:</span> Today page (if today), Week view, Plan calendar (Day/Week/Month). Styled in indigo to distinguish from tasks.</li>
              <li><span className="text-white">Missed events:</span> Past events that weren't marked done appear in the Triage "Missed" tab alongside missed tasks.</li>
            </ul>
          </div>
        </section>

        {/* Habits */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Habits</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>Habits track recurring activities. Two modes:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li><span className="text-white">Fixed Schedule:</span> Set a recurrence (Daily, Weekly, Monthly, etc.). The habit is "due" when the interval has passed since last completion.</li>
              <li><span className="text-white">X Times Per Week:</span> Set a weekly target (e.g., 3x per week). The habit is due until you hit the target for the current week.</li>
            </ul>
            <p>Due habits appear on the <span className="text-white">Today</span> page where you can mark them done. The Habits page groups them into Due Now, On Track, and Paused. You can pause a habit without deleting it.</p>
          </div>
        </section>

        {/* Domains */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Domains</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>Domains are life areas like Work, Health, Finance, or Personal. They help you organize tasks, events, and projects by category.</p>
            <p>Each domain has a <span className="text-white">priority level</span> that influences how tasks within it are scored:</p>
            <div className="space-y-1 ml-4 mt-2">
              <p><span className="text-red-400">Critical</span> — core life areas that matter most</p>
              <p><span className="text-orange-400">Important</span> — significant areas deserving regular attention</p>
              <p><span className="text-blue-400">Maintenance</span> — ongoing upkeep areas</p>
            </div>
          </div>
        </section>

        {/* Auto-Suggest */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Auto-Suggest</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>The Plan page has two suggestion features to help with scheduling:</p>
            <p><span className="text-white">Suggest Next Task:</span> Highlights the single best task to work on next, based on score, deadline pressure, domain balance, and effort. Skip to see alternatives.</p>
            <p><span className="text-white">Suggest Week Schedule:</span> Available in the Week calendar view. Distributes unscheduled tasks across 7 days respecting your daily AP budget. Deadline tasks get placed first, then flexible tasks by score. You can pin/unpin suggestions, then Apply All or Discard.</p>
            <p>Configure weights, daily AP budget, default AP, and domain focus via the settings gear icon in the Planning view.</p>
          </div>

          <Collapsible title="How suggestion scoring works">
            <div className="space-y-2 text-sm text-[var(--muted)] pt-3">
              <p>Each task gets a suggestion score combining four factors (weights configurable):</p>
              <ul className="list-disc ml-4 space-y-1">
                <li><span className="text-white">Base Score:</span> The task's combined importance x urgency score</li>
                <li><span className="text-white">Deadline Pressure:</span> Bonus for tasks with approaching due dates</li>
                <li><span className="text-white">Domain Balance:</span> Favors tasks from underrepresented domains in your week</li>
                <li><span className="text-white">Effort Match:</span> Prefers tasks whose AP fits remaining daily budget</li>
              </ul>
              <p className="mt-2">Week scheduling uses greedy bin-packing: deadline tasks first, then flexible tasks by score, respecting the daily AP budget.</p>
            </div>
          </Collapsible>
        </section>

        {/* Recurring Tasks */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Recurring Tasks & Events</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>Tasks and events can recur on a schedule. When a recurring task is marked Done, it stays done until the interval passes, then automatically resets to Backlog (or Planned if it has a planned date).</p>
            <p>This check runs automatically when you open the app each day. You can also trigger it manually from Settings.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {['Daily', 'Weekly', 'Biweekly', 'Monthly', 'Bimonthly', 'Quarterly', 'Half-Yearly', 'Yearly'].map(r => (
                <span key={r} className="px-2 py-1 rounded bg-[var(--background)] text-[var(--muted)]">{r}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Filtering & Sorting */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Filtering, Sorting & Presets</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>The Tasks and Plan pages have powerful filter and sort controls:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li><span className="text-white">Filters:</span> Multi-select by status, priority, urgency, domain, project, recurrence, action points, and due date ranges (overdue, today, this week, etc.)</li>
              <li><span className="text-white">Sort:</span> Multi-level sorting — sort by score, then by priority, then by name, etc.</li>
              <li><span className="text-white">Columns:</span> On the Tasks page, toggle which columns are visible</li>
              <li><span className="text-white">Filter Presets:</span> Create saved filter combinations in Settings with custom names and colors. They appear as quick-toggle buttons in the Planning view.</li>
            </ul>
            <p>All filter, sort, and column preferences are saved automatically and persist between sessions.</p>
          </div>
        </section>

        {/* Workflow */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Recommended Workflow</h2>
          <div className="space-y-4 text-sm">
            <div className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">1</span>
              <div>
                <p className="text-white font-medium">Capture</p>
                <p className="text-[var(--muted)]">Add tasks as they come up. Don't worry about filling in every field — they'll land in "Needs Details" and you can triage later.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">2</span>
              <div>
                <p className="text-white font-medium">Organize</p>
                <p className="text-[var(--muted)]">Assign tasks to domains and projects. Set priority, urgency, and action points. Group related work into projects to track progress.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">3</span>
              <div>
                <p className="text-white font-medium">Plan</p>
                <p className="text-[var(--muted)]">Use the Plan page to triage (clear out Needs Details, unblock tasks, handle overdue items), then drag tasks onto the calendar or use auto-suggest to schedule your week.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">4</span>
              <div>
                <p className="text-white font-medium">Execute</p>
                <p className="text-[var(--muted)]">Work from the Today view each day. Mark tasks, habits, and events complete. Check off habits as you go.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">5</span>
              <div>
                <p className="text-white font-medium">Review</p>
                <p className="text-[var(--muted)]">Check the Eisenhower Matrix to see if your priorities are balanced. Review project progress bars. Use the Week view to see your load distribution.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Priority & Urgency */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Priority & Urgency</h2>
          <div className="text-sm text-[var(--muted)] mb-4">
            <p>Every task has two separate axes that combine into its overall score:</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white font-medium mb-2">Priority (Importance)</p>
              <div className="space-y-1 text-[var(--muted)]">
                <p><span className="text-red-400">1 - Urgent:</span> Must do immediately</p>
                <p><span className="text-orange-400">2 - High:</span> Important, do soon</p>
                <p><span className="text-blue-400">3 - Normal:</span> Standard priority</p>
                <p><span className="text-gray-400">4 - Low:</span> When you have time</p>
                <p><span className="text-gray-500">5 - Optional:</span> Nice to have</p>
              </div>
            </div>
            <div>
              <p className="text-white font-medium mb-2">Urgency (Time Sensitivity)</p>
              <div className="space-y-1 text-[var(--muted)]">
                <p><span className="text-red-400">1 - Critical:</span> Act now</p>
                <p><span className="text-orange-400">2 - High:</span> Pressing deadline</p>
                <p><span className="text-blue-400">3 - Normal:</span> Standard timeline</p>
                <p><span className="text-gray-400">4 - Low:</span> No rush</p>
                <p><span className="text-gray-500">5 - Someday:</span> No deadline at all</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Collapsible title="How task scoring works">
              <div className="space-y-3 text-sm text-[var(--muted)] pt-3">
                <div className="bg-[var(--background)] rounded-lg p-3">
                  <p className="text-white font-medium mb-1">Importance Score <span className="font-normal text-[var(--muted)]">(20–80)</span></p>
                  <p className="font-mono text-white text-xs">Importance = Task Priority + Domain Priority</p>
                  <p className="mt-1">Task Priority: Urgent (50), High (40), Normal (30), Low (20), Optional (10)</p>
                  <p>Domain Priority: Critical (30), Important (20), Maintenance (10)</p>
                </div>
                <div className="bg-[var(--background)] rounded-lg p-3">
                  <p className="text-white font-medium mb-1">Urgency Score <span className="font-normal text-[var(--muted)]">(10–100)</span></p>
                  <p className="font-mono text-white text-xs">Urgency = Urgency Field + Due Date Proximity</p>
                  <p className="mt-1">Urgency Field: Critical (50), High (40), Normal (30), Low (20), Someday (10)</p>
                  <p>Due Date Bonus: Overdue (+50) down to 2+ months away (+5)</p>
                </div>
                <div className="bg-[var(--background)] rounded-lg p-3">
                  <p className="text-white font-medium mb-1">Combined Score</p>
                  <p className="font-mono text-white text-xs">Combined = (Importance x Urgency) / 100</p>
                  <p className="mt-1">This is the main score used for default sorting and the Eisenhower Matrix position.</p>
                </div>
              </div>
            </Collapsible>
          </div>
        </section>

        {/* Eisenhower Matrix */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Eisenhower Matrix</h2>
          <p className="text-[var(--muted)] text-sm mb-4">
            The Matrix view in the Plan page plots your active tasks on two axes — Importance (Y) vs. Urgency (X) — to help you decide what to focus on:
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 font-medium">Do Now</p>
              <p className="text-[var(--muted)] text-xs">High importance + High urgency</p>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
              <p className="text-purple-400 font-medium">Schedule</p>
              <p className="text-[var(--muted)] text-xs">High importance + Low urgency</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-amber-400 font-medium">Fit In</p>
              <p className="text-[var(--muted)] text-xs">Low importance + High urgency</p>
            </div>
            <div className="bg-slate-500/10 border border-slate-500/20 rounded-lg p-3">
              <p className="text-slate-400 font-medium">Backburner</p>
              <p className="text-[var(--muted)] text-xs">Low importance + Low urgency</p>
            </div>
          </div>
          <p className="text-[var(--muted)] text-sm mt-3">
            Click dots to see task names, then click a task to edit it. Filters from the Planning view apply here too.
          </p>
        </section>

        {/* Sync */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Data & Sync</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>
              <span className="text-white">Local First:</span> All data is stored in your browser. The app works fully offline — no account required.
            </p>
            <p>
              <span className="text-white">Google Drive Backup:</span> Optionally sign in with Google to back up your data. Everything is stored in your personal Google Drive as a JSON file.
            </p>
            <p>
              <span className="text-white">Push:</span> Uploads all your local data to Google Drive, replacing the remote backup.
            </p>
            <p>
              <span className="text-white">Pull:</span> Downloads data from Google Drive and replaces all local data. You'll be warned if you have unpushed local changes.
            </p>
            <p>
              <span className="text-white">Deletions sync too:</span> Deleted items are kept as hidden "tombstones" so they propagate across devices. Push on one device, pull on another.
            </p>
            <p>
              <span className="text-white">Privacy:</span> No central server. Your data stays on your devices and your personal Google Drive. No one else can access it.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
