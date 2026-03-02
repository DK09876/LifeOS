'use client';

export default function HelpPage() {
  return (
    <div className="max-w-3xl">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">How it Works</h1>
        <p className="text-[var(--muted)]">Learn how to use LifeOS effectively</p>
      </div>

      <div className="space-y-8">
        {/* Pages Section */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Pages</h2>
          <div className="space-y-3 text-sm">
            <div className="flex gap-4">
              <span className="text-xl w-8">📍</span>
              <div>
                <p className="text-white font-medium">Today</p>
                <p className="text-[var(--muted)]">View tasks that are due or planned for today. Quick stats show your progress. Mark tasks complete as you finish them.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8">📅</span>
              <div>
                <p className="text-white font-medium">Week</p>
                <p className="text-[var(--muted)]">Calendar view showing your week. Navigate between weeks and see tasks by day. Click on a day to add tasks directly to that date.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8">📋</span>
              <div>
                <p className="text-white font-medium">Plan</p>
                <p className="text-[var(--muted)]">Triage tasks that need attention, review your backlog sorted by score, assign planned dates to schedule work, and view the Eisenhower Matrix to visualize importance vs. urgency.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8">📁</span>
              <div>
                <p className="text-white font-medium">Tasks</p>
                <p className="text-[var(--muted)]">Full database view with all task fields. Sort by any column, filter by status or domain, and search across all tasks.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8">🗂️</span>
              <div>
                <p className="text-white font-medium">Domains</p>
                <p className="text-[var(--muted)]">Life areas like Work, Health, Finance, etc. Each domain has a priority that affects task scoring. Assign tasks to domains to organize your life.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-xl w-8">🔄</span>
              <div>
                <p className="text-white font-medium">Habits</p>
                <p className="text-[var(--muted)]">Track recurring habits with daily, weekly, or monthly recurrence. Due habits appear on Today. View weekly completion progress on the Habits page.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Task Score Section */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Task Scoring</h2>
          <p className="text-[var(--muted)] text-sm mb-4">
            Each task has three scores that help you prioritize: Importance, Urgency, and a Combined score.
          </p>

          <div className="space-y-4">
            <div className="bg-[var(--background)] rounded-lg p-4 text-sm">
              <p className="text-white font-medium mb-2">Importance Score <span className="text-[var(--muted)] font-normal">(range 20–80)</span></p>
              <p className="text-white font-mono mb-2">Importance = Task Priority + Domain Priority</p>
              <div className="space-y-1 text-[var(--muted)]">
                <p><span className="text-white">Task Priority:</span> Urgent (50) → High (40) → Normal (30) → Low (20) → Optional (10)</p>
                <p><span className="text-white">Domain Priority:</span> Critical (30) → Important (20) → Maintenance (10)</p>
              </div>
            </div>

            <div className="bg-[var(--background)] rounded-lg p-4 text-sm">
              <p className="text-white font-medium mb-2">Urgency Score <span className="text-[var(--muted)] font-normal">(range 10–100)</span></p>
              <p className="text-white font-mono mb-2">Urgency = Urgency Field + Due Date Proximity</p>
              <div className="space-y-1 text-[var(--muted)]">
                <p><span className="text-white">Urgency Field:</span> Critical (50) → High (40) → Normal (30) → Low (20) → Someday (10)</p>
                <p><span className="text-white">Due Date Proximity:</span> Overdue (+50) → Today (+45) → Tomorrow (+40) → 2 days (+35) → 3-4 days (+30) → Week (+25) → 2 weeks (+20) → Month (+15) → 2 months (+10) → Later (+5)</p>
              </div>
            </div>

            <div className="bg-[var(--background)] rounded-lg p-4 text-sm">
              <p className="text-white font-medium mb-2">Combined Score</p>
              <p className="text-white font-mono">Combined = (Importance × Urgency) / 100</p>
              <p className="text-[var(--muted)] mt-1">This is the main score used for sorting and the Eisenhower Matrix.</p>
            </div>
          </div>
        </section>

        {/* Eisenhower Matrix Section */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Eisenhower Matrix</h2>
          <p className="text-[var(--muted)] text-sm mb-4">
            The Matrix tab in the Plan page plots your active tasks on two axes — Importance (Y) vs. Urgency (X) — forming four quadrants:
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 font-medium">Do Now</p>
              <p className="text-[var(--muted)] text-xs">High importance + High urgency. Handle these immediately.</p>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
              <p className="text-purple-400 font-medium">Schedule</p>
              <p className="text-[var(--muted)] text-xs">High importance + Low urgency. Plan time for these.</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-amber-400 font-medium">Fit In</p>
              <p className="text-[var(--muted)] text-xs">Low importance + High urgency. Time-sensitive but minor — squeeze these in.</p>
            </div>
            <div className="bg-slate-500/10 border border-slate-500/20 rounded-lg p-3">
              <p className="text-slate-400 font-medium">Backburner</p>
              <p className="text-[var(--muted)] text-xs">Low importance + Low urgency. Low priority, deal with later or never.</p>
            </div>
          </div>
          <p className="text-[var(--muted)] text-sm">
            Click dots to see task names in a pinned tooltip, then click a task to edit it.
          </p>
        </section>

        {/* Events Section */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Events</h2>
          <p className="text-[var(--muted)] text-sm mb-4">
            Events are calendar appointments and time commitments — distinct from tasks. They appear on the calendar alongside tasks with indigo styling.
          </p>
          <div className="space-y-2 text-sm text-[var(--muted)]">
            <p><span className="text-white">Date & Time:</span> Events always have a date. Optionally set a time and duration (in minutes).</p>
            <p><span className="text-white">Recurrence:</span> Events can recur on the same schedule as tasks (Daily, Weekly, Monthly, etc.). Recurring events auto-reset when their interval passes.</p>
            <p><span className="text-white">Action Points:</span> Optionally assign action points to estimate effort, same as tasks.</p>
            <p><span className="text-white">Where they show:</span> Events appear on the Today page (if scheduled today), Week view, and Plan calendar. They are not completable like tasks — they represent time blocks.</p>
            <p><span className="text-white">Sync:</span> Events are included in Google Drive push/pull alongside tasks, domains, and habits.</p>
          </div>
        </section>

        {/* Statuses Section */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Task Statuses</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs">Needs Details</span>
              <p className="text-[var(--muted)]">Task is missing information. Fill in details before it can be worked on.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">Backlog</span>
              <p className="text-[var(--muted)]">Ready to be worked on. Assign a planned date to schedule it.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs">Planned</span>
              <p className="text-[var(--muted)]">Scheduled for a specific date. Automatically set when a planned date is assigned.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-gray-500/20 text-gray-400 text-xs">Blocked</span>
              <p className="text-[var(--muted)]">Waiting on something external. Can't be worked on right now.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs">Done</span>
              <p className="text-[var(--muted)]">Completed. Will be hidden from active views.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-gray-600/20 text-gray-500 text-xs">Archived</span>
              <p className="text-[var(--muted)]">No longer relevant. Hidden from all views except the Tasks database.</p>
            </div>
          </div>
        </section>

        {/* Priority & Urgency Section */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Priority & Urgency Levels</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-white font-medium mb-2">Task Priority (Importance)</p>
              <div className="space-y-1">
                <p><span className="text-red-400">1 - Urgent:</span> <span className="text-[var(--muted)]">Must do immediately</span></p>
                <p><span className="text-orange-400">2 - High:</span> <span className="text-[var(--muted)]">Important, do soon</span></p>
                <p><span className="text-blue-400">3 - Normal:</span> <span className="text-[var(--muted)]">Standard priority</span></p>
                <p><span className="text-gray-400">4 - Low:</span> <span className="text-[var(--muted)]">When you have time</span></p>
                <p><span className="text-gray-500">5 - Optional:</span> <span className="text-[var(--muted)]">Nice to have</span></p>
              </div>
            </div>
            <div>
              <p className="text-white font-medium mb-2">Urgency</p>
              <div className="space-y-1">
                <p><span className="text-red-400">1 - Critical:</span> <span className="text-[var(--muted)]">Time-sensitive, act now</span></p>
                <p><span className="text-orange-400">2 - High:</span> <span className="text-[var(--muted)]">Pressing deadline</span></p>
                <p><span className="text-blue-400">3 - Normal:</span> <span className="text-[var(--muted)]">Standard timeline</span></p>
                <p><span className="text-gray-400">4 - Low:</span> <span className="text-[var(--muted)]">No rush</span></p>
                <p><span className="text-gray-500">5 - Someday:</span> <span className="text-[var(--muted)]">No deadline</span></p>
              </div>
            </div>
            <div>
              <p className="text-white font-medium mb-2">Domain Priority</p>
              <div className="space-y-1">
                <p><span className="text-red-400">1 - Critical:</span> <span className="text-[var(--muted)]">Core life areas</span></p>
                <p><span className="text-orange-400">2 - Important:</span> <span className="text-[var(--muted)]">Significant areas</span></p>
                <p><span className="text-blue-400">3 - Maintenance:</span> <span className="text-[var(--muted)]">Ongoing upkeep</span></p>
              </div>
            </div>
          </div>
        </section>

        {/* Recurring Tasks Section */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Recurring Tasks</h2>
          <p className="text-[var(--muted)] text-sm mb-4">
            Set a recurrence pattern for tasks that repeat. When completed, recurring tasks are automatically reset to your backlog when their interval passes (checked on each app load, or manually via Settings).
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-[var(--background)] text-[var(--muted)]">Daily</span>
            <span className="px-2 py-1 rounded bg-[var(--background)] text-[var(--muted)]">Weekly</span>
            <span className="px-2 py-1 rounded bg-[var(--background)] text-[var(--muted)]">Biweekly</span>
            <span className="px-2 py-1 rounded bg-[var(--background)] text-[var(--muted)]">Monthly</span>
            <span className="px-2 py-1 rounded bg-[var(--background)] text-[var(--muted)]">Bimonthly</span>
            <span className="px-2 py-1 rounded bg-[var(--background)] text-[var(--muted)]">Quarterly</span>
            <span className="px-2 py-1 rounded bg-[var(--background)] text-[var(--muted)]">Half-Yearly</span>
            <span className="px-2 py-1 rounded bg-[var(--background)] text-[var(--muted)]">Yearly</span>
          </div>
        </section>

        {/* Workflow Section */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Recommended Workflow</h2>
          <div className="space-y-4 text-sm">
            <div className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">1</span>
              <div>
                <p className="text-white font-medium">Capture</p>
                <p className="text-[var(--muted)]">Add new tasks as they come up. Don't worry about details yet — use "Needs Details" status.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">2</span>
              <div>
                <p className="text-white font-medium">Weekly Planning</p>
                <p className="text-[var(--muted)]">Use the Plan page to triage tasks, fill in details, unblock items, and reset recurring tasks.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">3</span>
              <div>
                <p className="text-white font-medium">Schedule</p>
                <p className="text-[var(--muted)]">Assign planned dates to tasks from the backlog. Use the Week view to balance your load.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">4</span>
              <div>
                <p className="text-white font-medium">Execute</p>
                <p className="text-[var(--muted)]">Work from the Today view. Focus on completing planned tasks and mark them done.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Sync Section */}
        <section className="bg-[var(--card-bg)] rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Data & Sync</h2>
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>
              <span className="text-white">Local First:</span> All data is stored locally in your browser using IndexedDB. The app works fully offline.
            </p>
            <p>
              <span className="text-white">Google Drive Backup:</span> Sign in with Google to back up your data. Data is stored in your personal Google Drive as a JSON file including tasks, domains, habits, events, filter presets, and preferences.
            </p>
            <p>
              <span className="text-white">Push:</span> Uploads your local data to Google Drive, replacing the remote backup. Tombstones older than 30 days are cleaned up before pushing.
            </p>
            <p>
              <span className="text-white">Pull:</span> Downloads data from Google Drive and replaces all local data. You'll be warned if you have unpushed local changes.
            </p>
            <p>
              <span className="text-white">Deletions:</span> Deleted items are soft-deleted (tombstoned) so they propagate across devices. Push on one device, pull on another to stay in sync.
            </p>
            <p>
              <span className="text-white">Privacy:</span> No central server. Your data stays on your devices and your Google Drive.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
