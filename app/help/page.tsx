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
            LifeOS is a personal productivity app for managing tasks, habits, events, and projects. Your data lives on a Raspberry Pi on your own network — there is no cloud account and nothing leaves your tailnet. Each profile keeps its own separate data, and you can download a backup at any time from Settings.
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
                <p className="text-[var(--muted)]">Your daily dashboard. Shows habits due today, today&rsquo;s events, and tasks planned or due today. Mark items complete with one click; completed items move to a collapsible &ldquo;Completed Today&rdquo; section where you can undo them. Above the list sit two things: an effort meter for the day, and — if you planned something for an earlier day and did not do it — a strip asking what you want to do about it.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8 flex-shrink-0">📅</span>
              <div>
                <p className="text-white font-medium">Week</p>
                <p className="text-[var(--muted)]">A 7-day calendar (Mon–Sun) showing what each day holds. Navigate between weeks; hover a day to add a task straight to it. A task appears on exactly one day: the day you planned it for, or — if you have not planned it — its due date, drawn dashed so a deadline you have not made room for looks different from work you have committed to. Finished tasks stay put, greyed out, so the week reads as a record rather than emptying as you go.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8 flex-shrink-0">📋</span>
              <div>
                <p className="text-white font-medium">Plan</p>
                <p className="text-[var(--muted)]">Your planning hub with three views:</p>
                <ul className="text-[var(--muted)] list-disc ml-4 mt-1 space-y-1">
                  <li><span className="text-white">Triage</span> — Review tasks that need attention: incomplete details, blocked tasks (with blocker info shown inline), missed planned dates, overdue due dates, and archived items.</li>
                  <li><span className="text-white">Planning</span> — Drag unscheduled tasks onto a Day/Week/Month calendar. The calendar shows what you have committed to and anything that has gone past its date; a future deadline you have not scheduled stays in the Unscheduled column, waiting to be placed, so the week does not look booked by work nobody has planned. Filter, sort, use presets, or let auto-suggest fill the week within your effort budget — choosing which days to plan into, and a style: balanced, deadline-driven, quick wins, or big rocks.</li>
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
                <p className="text-[var(--muted)]">Two shapes, because there are two kinds of project. A <span className="text-white">pile of work</span> is a set of tasks finished when they are all done — &ldquo;get the house clean&rdquo; — and its progress is completed action points. A <span className="text-white">goal you count towards</span> is something you chip away at and log — &ldquo;read a page, 300 times&rdquo; — and its progress is whatever you have logged, in its own unit.</p>
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
                <p className="text-[var(--muted)]">Download a backup of your data or restore one, configure filter presets for quick planning views, run recurring task resets manually, and toggle the Get Started page.</p>
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
              <p className="text-[var(--muted)]">Task is missing required info — it needs a name, priority, urgency, domain and action points. Fill all of them in and it automatically promotes to Backlog, or Planned if it also has a planned date.</p>
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
                <li>A task missing name, priority, urgency, domain or AP stays at <span className="text-yellow-400">Needs Details</span></li>
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
          <h2 className="text-lg font-medium text-white mb-4">Recurring Tasks &amp; Events</h2>
          <div className="mb-4 text-sm text-[var(--muted)] space-y-2">
            <p>
              A recurring task asks how the next one should be dated, and the answer depends on what kind of thing it is.
            </p>
            <p>
              <span className="text-white">When I finish it</span> restarts the clock on completion — right for anything you simply want to do every so often. Water the plants a few days late and the next one is a fortnight from then, not a fortnight from a date you already missed.
            </p>
            <p>
              A <span className="text-white">weekly</span> task can also name the days it lands on. Pick Mon, Wed and Fri and it comes back on the next of those, rather than a week after you last got to it — which is what &ldquo;every weekday&rdquo; means and what a plain weekly cycle could only approximate.
            </p>
            <p>
              <span className="text-white">The due date</span> keeps a fixed period — right for anything with a real deadline inside a window, like a fortnightly return or a monthly bill. Doing it four days early does not drag every future deadline four days earlier, and the next period opens as soon as the last one closes rather than an interval after you got to it.
            </p>
          </div>
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
                <p><span className="text-red-400">1 - Essential:</span> Matters most (how soon is urgency's job)</p>
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
                  <p className="text-white font-medium mb-1">Importance Score <span className="font-normal text-[var(--muted)]">(15–65)</span></p>
                  <p className="font-mono text-white text-xs">Importance = Task Priority + Domain Priority</p>
                  <p className="mt-1">Task Priority: Urgent (50), High (40), Normal (30), Low (20), Optional (10)</p>
                  <p>Domain Priority: Critical (15), Important (10), Maintenance (5)</p>
                  <p className="mt-1">The domain is a tiebreaker, not the verdict. What a task is worth is mostly what you said it is worth — otherwise anything filed under a quiet domain is capped below a trivial job in a loud one, and the things that matter most tend to live in the quiet ones.</p>
                </div>
                <div className="bg-[var(--background)] rounded-lg p-3">
                  <p className="text-white font-medium mb-1">Urgency Score <span className="font-normal text-[var(--muted)]">(10–120)</span></p>
                  <p className="font-mono text-white text-xs">Urgency = Urgency Field + Time Pressure</p>
                  <p className="mt-1">Urgency Field: Critical (50), High (40), Normal (30), Low (20), Someday (10)</p>
                  <p className="mt-2 text-white">Time pressure comes from one of two places:</p>
                  <p className="mt-1"><span className="text-white">A deadline</span> — due today (+45), tomorrow (+40), this week (+25), a month out (+15), further (+5).</p>
                  <p><span className="text-white">Overdue</span> climbs rather than flattening: +50 the first day late, rising each day to +62 by day five, +65 within the week, +68 within the month, +70 beyond it. Something that has rotted for months outranks something merely late.</p>
                  <p className="mt-1"><span className="text-white">A cycle</span> — a repeating task with no due date is due by the end of its own interval. "Every two weeks" already says when it is due, so a fortnight after you last did it, it is due today; a day later it is a day late, and it climbs from there.</p>
                  <p className="mt-1"><span className="text-white">Neglect</span> — pressure from nobody having said when this happens: +5 after two weeks untouched, +10 after a month, +15 after two, +20 after three. It applies whether or not there is a due date, because a deadline three months out does not make a task you have ignored for three months calm.</p>
                  <p className="mt-1">A <span className="text-white">planned date that has not passed</span> stops neglect accruing — you have committed to a day, so the task is waiting rather than drifting. Miss that day and it starts rotting again.</p>
                  <p className="mt-1">The two never add up: a task takes whichever reading is louder, so a plan can never mask a real deadline and lateness always wins.</p>
                </div>
                <div className="bg-[var(--background)] rounded-lg p-3">
                  <p className="text-white font-medium mb-1">Combined Score</p>
                  <p className="font-mono text-white text-xs">Combined = (Importance x Urgency) / 100</p>
                  <p className="mt-1">This is the main score used for default sorting and the Eisenhower Matrix position. Multiplied rather than added, so a task that is both important and urgent pulls clearly ahead of one that is merely a bit of each. Recalculated once a day, so an approaching deadline actually moves a task up your list.</p>
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
            The lines sit at an importance of 45 and an urgency of 65. Because urgency now grows both from a deadline approaching and from a task being left alone, something undated can drift rightwards into &ldquo;Do Now&rdquo; if you ignore it long enough — which is usually the moment you should look at it.
          </p>
          <p className="text-[var(--muted)] text-sm mt-3">
            Click dots to see task names, then click a task to edit it. Filters from the Planning view apply here too.
          </p>
        </section>

        {/* Projects: the two shapes */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Goals you count towards</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>
              A habit is indefinite — something you do to keep doing it. A goal is finite and tangible: read a book, run a hundred miles, learn a hundred words. The difference is that a goal <em>ends</em>, and you want to see it getting closer.
            </p>
            <p>
              A goal project has a count and a unit, and you log against it: <span className="text-white">&ldquo;read two pages today&rdquo;</span> adds two. Nothing is tied to completing a task or a habit, which is the point — you did some amount of the thing, and you say so.
            </p>
            <p>
              Tying it to a recurring task was the obvious approach and it did not work: a recurring task is Done only between finishing it and the next rollover, so the bar swung between 0% and 100% instead of adding up. Fifty pages read left the project exactly where it started.
            </p>
            <p>
              Leave the count blank to tally with no finish line. A run of days with something logged shows as a streak, and &ldquo;undo today&rdquo; takes back a mis-log.
            </p>
          </div>
        </section>

        {/* The day's effort */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">The day&rsquo;s effort</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>
              Tasks, events and habits all carry an effort estimate, and Today shows three numbers built from them: what the day is allowed to cost, what it has cost so far, and what is still committed.
            </p>
            <p>
              The scale is about how much of a day something takes, not how long it lasts on a clock — a twenty-minute conversation you have been dreading costs more than an hour of easy admin. <span className="text-white">Free</span> is for things worth keeping but not worth planning around, <span className="text-white">Tiny</span> a few minutes, <span className="text-white">Small</span> half an hour, <span className="text-white">Real</span> about an hour or anything you must be present for, <span className="text-white">Heavy</span> a couple of hours of focus, and <span className="text-white">Big</span> eats an afternoon.
            </p>
            <p>
              Habits count too. Three of them can easily be a third of what a day actually costs, and a budget that ignored them read as far emptier than the day really was.
            </p>
            <p>
              <span className="text-white">Capacity</span> starts from the daily budget you set in Plan, and the − and + buttons change it for today alone. Some days you have less in you, and the plan should be able to say so without changing your normal.
            </p>
            <p>
              <span className="text-white">Used</span> counts what you have finished today — including things you had planned for an earlier day, because the effort was spent today either way.
            </p>
            <p>
              <span className="text-white">Habits are reserved, not scheduled.</span> The planner subtracts what your habits will cost a day before it offers anything to tasks, and the day footer names it — <span className="font-mono text-white">AP: 3/8 +3h</span> means three points of tasks, three more already owed to habits. Before this it offered a whole budget on a day that already had a gym session in it, and Today&rsquo;s meter and the planner disagreed about the same day.
            </p>
            <p>
              <span className="text-white">Planned left</span> is what you are still signed up for. This is the number that warns you before the day rather than after it: if the bar is already past the end, something needs to move.
            </p>
            <p>
              Going over is not an error and nothing stops you. The bar turns amber and says what happened, so that a run of overspent days is visible rather than something you only feel.
            </p>
          </div>
        </section>

        {/* Missed plans */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Plans you missed</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>
              When you planned something for a day and the day passed without it, it does not silently join today&rsquo;s list. A day that absorbs everything you meant to do earlier stops being a plan and becomes a pile, and a pile is something you stop reading.
            </p>
            <p>
              Instead they collect in a strip at the top of Today, collapsed to a count. Open it and each one offers the decision directly: do it today, push it to tomorrow, unplan it, or mark it done. There is a &ldquo;move all to today&rdquo; if that is genuinely what you want.
            </p>
            <p>
              Work that is <span className="text-white">blocked</span> is handled separately again. It stops scoring while it waits — being stuck behind someone else is not the same as neglecting something — and instead takes a date to chase it up. On that day it appears in its own strip asking whether to chase, defer or unblock.
            </p>
            <p>
              This is only about <span className="text-white">plans</span> — intentions you set. An overdue <span className="text-white">deadline</span> is a different thing and stays in Plan → Triage → Overdue, where it also climbs your task scores the longer it goes unaddressed.
            </p>
          </div>
        </section>

        {/* Habit history */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Streaks and history</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>
              Each habit shows the run it is on, its best run, and the last 30 days as dots — filled where you did it, dimmer at weekends, ringed on today.
            </p>
            <p>
              <span className="text-white">The unit follows the habit.</span> A plain daily habit streaks in days. A habit with a weekly target streaks in weeks that hit the target, because counting its days would show the chain breaking every single week.
            </p>
            <p>
              A habit with a weekly target shows both: the run of target-hitting weeks as the headline, and the consecutive days alongside it. Three days running on a five-a-week habit is a real thing, and the weekly number on its own reports it as nothing.
            </p>
            <p>
              A streak does not break just because today is not done yet — the day is not over. It breaks when a day (or a target week) is genuinely missed.
            </p>
          </div>
        </section>

        {/* Quick capture */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Capturing quickly</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>
              The <span className="text-white">+</span> button in the top bar opens a new task from any page, and pressing <span className="font-mono text-white">n</span> does the same without reaching for the mouse. It will not fire while you are typing in a field.
            </p>
            <p>
              The form asks for five things: what it is, how much it matters, how soon, where it belongs and what it costs. Everything else — planned date, project, recurrence, blockers, notes — sits behind <span className="text-white">More options</span>, and opens by itself when you edit a task that already uses it.
            </p>
            <p>
              It is the same form as everywhere else, so a task captured in a hurry follows the same rules — a name on its own lands in Needs Details, waiting for you to triage it rather than pretending it has been thought about.
            </p>
          </div>
        </section>

        {/* Retrospect */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Retrospect</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>
              Every other page is about what to do next. This one is the only place the app says something about you rather than about your list.
            </p>
            <p>
              <span className="text-white">Your days</span> draws the last four weeks as bars, each against the budget you had set for that day, so you can see whether the number you chose has any relationship to the days you actually have. A budget you blow every week is not a budget.
            </p>
            <p>
              <span className="text-white">Habits</span> shows every streak and its 30-day strip in one place, which is easier to read than one card at a time.
            </p>
            <p>
              A day is written up the first time you open the app the following morning — the first moment it is finished and safe to total. Only completions are recorded; what you had <em>planned</em> for a past day cannot be recovered afterwards, and a guess would make the record less trustworthy than none.
            </p>
          </div>
        </section>

        {/* Data */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Where your data lives</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>
              <span className="text-white">On your Pi:</span> One SQLite database on a Raspberry Pi on your own network holds every profile. The browser keeps a copy for speed and writes straight back to the Pi, so a change made on your laptop shows up on your phone within a couple of seconds — and so does one made by the voice assistant.
            </p>
            <p>
              <span className="text-white">Profiles are separate:</span> Each person has their own data. Switching profiles in the top right reloads from the server; nothing is shared between them.
            </p>
            <p>
              <span className="text-white">Nightly snapshots:</span> The Pi snapshots the database every night and keeps the recent ones, skipping nights where nothing changed. That protects you from mistakes and corruption.
            </p>
            <p>
              <span className="text-white">Download a backup:</span> Snapshots live on the same SD card as the database, so they do not protect you from the card failing. Settings → Your data downloads everything as a single JSON file, and restores one. Do this occasionally; the app will remind you monthly.
            </p>
            <p>
              <span className="text-white">Restoring replaces:</span> Importing a backup swaps out everything in the current profile. You are asked to confirm, and told how many records are coming in, before anything is touched.
            </p>
            <p>
              <span className="text-white">Deletions:</span> Deleted items are kept briefly as hidden &ldquo;tombstones&rdquo; rather than removed outright, so a delete on one device is not undone by another device that had not caught up yet.
            </p>
            <p>
              <span className="text-white">Privacy:</span> No cloud account and no third party. The Pi is reachable only over your own tailnet.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
