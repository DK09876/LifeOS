'use client';

/**
 * How it works.
 *
 * Every number in an Example below is asserted in lib/scenarios.test.ts. If
 * you change a rule, change both - the point of these examples is that the
 * app does exactly what they say.
 */

import { useState } from 'react';

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--card-hover)] transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm text-[var(--muted)]">{title}</span>
        <span className="text-[var(--muted)] text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-3 border-t border-[var(--border-color)]">{children}</div>}
    </div>
  );
}

/** A worked example: a situation, then what the app does, step by step. */
function Example({ title, setup, steps }: { title: string; setup: React.ReactNode; steps: Array<[string, React.ReactNode]> }) {
  return (
    <Collapsible title={`Example — ${title}`}>
      <p className="text-sm text-[var(--muted)] mb-3">{setup}</p>
      <ol className="space-y-2 text-sm">
        {steps.map(([when, what], i) => (
          <li key={i} className="flex gap-3">
            <span className="w-24 flex-shrink-0 text-white">{when}</span>
            <span className="text-[var(--muted)]">{what}</span>
          </li>
        ))}
      </ol>
    </Collapsible>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[var(--card-bg)] rounded-lg p-5 sm:p-6">
      <h2 className="text-lg font-medium text-white mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-[var(--muted)]">{children}</div>
    </section>
  );
}

const W = ({ children }: { children: React.ReactNode }) => <span className="text-white">{children}</span>;
/** importance / urgency → score */
const S = ({ i, u, s }: { i: number; u: number; s: number }) => (
  <span className="font-mono text-xs text-white whitespace-nowrap">{i} × {u} → {s}</span>
);

export default function HelpPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white mb-1">How it Works</h1>
        <p className="text-[var(--muted)]">What each thing is for, and what the app does with it — with worked examples</p>
      </div>

      <div className="space-y-6">
        <Section title="The idea">
          <p>
            Get your backlog done in good time without losing track of how much energy you have. Capture things quickly,
            sort them once, put them on days that have room, do them, and look back at how it went.
          </p>
          <p>
            Every piece of work has a cost in <W>AP</W> (action points, 0–5: time plus mental effort), and every day has a
            budget. A day only spends AP on what is actually planned on it.
          </p>
        </Section>

        <Section title="What goes where">
          <ul className="space-y-2">
            <li><W>Task</W> — work you finish. One-off (&ldquo;pay the electricity bill&rdquo;) or repeating (&ldquo;water the plants every 2 weeks&rdquo;).</li>
            <li><W>Habit</W> — something you keep doing for its own sake, with no finish line: brushing your teeth, the gym 3× a week. Tracked with streaks.</li>
            <li><W>Event</W> — happens at a set time whether you plan it or not: the dentist on Thursday at 2.</li>
            <li><W>Project</W> — either a <W>pile of work</W> (&ldquo;get the house clean&rdquo;: five tasks, done when they are all done) or a <W>goal you count towards</W> (&ldquo;Read a Book&rdquo;: pages, with or without a total).</li>
            <li><W>Notes &amp; Lists</W> — things to remember and checklists like shopping. No dates, no effort, never in the backlog.</li>
            <li><W>Domain</W> — an area of life (Work, Home, Finance). A small tiebreaker in scoring, and a way to see where your effort goes.</li>
          </ul>
        </Section>

        <Section title="Pages">
          <ul className="space-y-2">
            <li><W>Today</W> — what you have to do today: tasks planned for today or due today, habits due, today&rsquo;s events, and the energy meter. One collapsed <W>Worth a look</W> line holds anything that needs a decision (see below).</li>
            <li><W>Yesterday</W> — tick off what you forgot. It counts on yesterday everywhere.</li>
            <li><W>Week</W> — a record of the week: planned work, deadlines you have not planned yet (dashed), finished work, and every occurrence of repeating tasks.</li>
            <li><W>Plan</W> — <W>Triage</W> (needs details, blocked, missed, overdue), <W>Planning</W> (the backlog beside a calendar, and Suggest) and <W>Matrix</W> (tasks sorted by importance and urgency).</li>
            <li><W>Review</W> — a week or a month looked back on: energy, backlog, domains, what slipped, habits, goals.</li>
          </ul>
          <p>On a phone the tab bar along the bottom has Today, Plan, Week and Yesterday; everything else is under More.</p>
        </Section>

        <Section title="Capturing and triage">
          <p>
            A task stays in <W>Needs Details</W> until it has all four of: <W>priority</W> (how much it matters),
            <W> urgency</W> (how soon), a <W>domain</W>, and its <W>AP</W>. Then it moves to the backlog by itself — or
            straight to Planned if it has a planned date.
          </p>
          <p>
            Anything left in Needs Details through a Saturday or Sunday is nagged about every day until it is sorted:
            in Today&rsquo;s Worth a look, on Plan, and in the morning brief.
          </p>
          <Example
            title="capturing by voice"
            setup="You say “add buy milk” to the voice assistant on Tuesday."
            steps={[
              ['Tuesday', <>A task &ldquo;buy milk&rdquo; appears in Plan → Triage → Needs Details. Voice cannot know urgency or AP, so it waits there rather than pretending it was thought about.</>],
              ['Saturday', <>Still unsorted, so it is now nagged: &ldquo;1 capture still needs details&rdquo;.</>],
              ['Better', <>&ldquo;Add milk to the shopping list&rdquo; puts it on the Shopping list in Notes &amp; Lists instead — it was never a task.</>],
            ]}
          />
        </Section>

        <Section title="How a task is scored">
          <p>Every list sorts by score. <W>Score = importance × urgency ÷ 100</W>.</p>
          <ul className="space-y-1">
            <li><W>Importance</W> = your priority (Essential 50, High 40, Normal 30, Low 20, Optional 10) + the domain (Critical 15, Important 10, Maintenance 5).</li>
            <li><W>Urgency</W> = your urgency (Critical 50, High 40, Normal 30, Low 20, Someday 10) + <W>time pressure</W>.</li>
          </ul>
          <p>Time pressure is the loudest one of these that applies — never the sum:</p>
          <ul className="space-y-1">
            <li><W>A deadline</W> — +5 a long way off, rising to +45 on the day; once overdue +50, climbing each day to +70.</li>
            <li><W>A follow-up day</W> on blocked work — scored like a deadline from the day it arrives.</li>
            <li><W>A missed cycle</W> of a repeating task — +36 the first day, more for each whole cycle missed, never above +49.</li>
            <li><W>A missed plan</W> — +32, rising to +44.</li>
            <li><W>Rot</W> — nobody has said when it happens: +5 after 2 weeks, +10 after a month, +15 after two, +20 after three. Counted from when the task was written, not the last edit. A plan for a day still to come pauses it.</li>
          </ul>
          <p>
            <W>Slips</W> are added on top: each time a missed plan is moved again, +4 (up to +16).
            In the Matrix, importance of 45+ is &ldquo;important&rdquo; and urgency of 65+ is &ldquo;urgent&rdquo;.
          </p>
          <Example
            title="a bill with a deadline"
            setup="“Pay electricity bill” — High priority, Normal urgency, Finance (Important), due Friday the 9th."
            steps={[
              ['Mon 5th', <><S i={50} u={60} s={30} />. In the Matrix it is under Schedule. It shows dashed on Friday in Week, and in Plan&rsquo;s Unscheduled list.</>],
              ['Fri 9th', <><S i={50} u={75} s={38} /> — due today, so it is on Today and moves to Do Now.</>],
              ['Sat 10th', <><S i={50} u={80} s={40} /> — overdue. Pinned in red at the top of Plan&rsquo;s Unscheduled list, counted on Plan&rsquo;s chips and in the morning brief.</>],
              ['Mon 19th', <><S i={50} u={98} s={49} /> — ten days late and still climbing.</>],
            ]}
          />
          <Example
            title="something with no date"
            setup="“Clean the garage” — Normal / Normal, Home (Maintenance), written on the 5th, never planned."
            steps={[
              ['Day one', <><S i={35} u={30} s={11} /></>],
              ['2 weeks', <><S i={35} u={35} s={12} /> — starting to rot.</>],
              ['A month', <><S i={35} u={40} s={14} /></>],
              ['3 months', <><S i={35} u={50} s={18} /> — as loud as rot gets. Renaming it or changing its notes does not reset this.</>],
              ['Planned', <>Put it on next Saturday and it drops back to <S i={35} u={30} s={11} /> until Saturday — a plan answers &ldquo;when&rdquo;. Miss Saturday and it becomes a missed plan.</>],
            ]}
          />
          <Example
            title="a plan that keeps sliding"
            setup="“Email the landlord” — Normal / Normal, Home (Important), planned for Monday."
            steps={[
              ['Mon', <><S i={40} u={30} s={12} /></>],
              ['Tue', <>Monday went by: <S i={40} u={62} s={25} />. It shows in Today&rsquo;s &ldquo;plans you missed&rdquo; strip with Today / Tomorrow / Unplan / Done (Unplan can be undone).</>],
              ['Tue', <>You move it to Wednesday: that is a slip. <S i={40} u={34} s={14} /> — planned again, but the slip stays.</>],
              ['Thu', <>Missed again: <S i={40} u={66} s={26} />.</>],
              ['Thu', <>Moved to Saturday: second slip, <S i={40} u={38} s={15} />. Each slide makes it louder, not quieter.</>],
            ]}
          />
        </Section>

        <Section title="Planning and energy">
          <p>
            Your daily budget is set in <W>Settings → Daily energy</W>: one number, optionally different per weekday. The
            − / + on Today changes just today. A day&rsquo;s load is: tasks planned for it or due on it, its events, the
            habits due that day, and any occurrences of repeating tasks planned onto it. Over budget turns the meter amber
            — nothing stops you, but you see it.
          </p>
          <p>
            <W>📅 Plan</W> on any task opens the next eight days with what each already holds, e.g. &ldquo;7/9 AP&rdquo;. It is how
            you plan on a phone, where dragging does not work.
          </p>
          <p>
            <W>Suggest</W> fills this week or next, never past a day&rsquo;s budget, after setting aside what habits need.
            Anything with a date — a deadline, a missed plan, a repeating task&rsquo;s cycle — goes on the <W>earliest day with
            room</W> before it is due, not on the due day itself. Everything else goes where it scores best. Accept all of it,
            or pin the ones you want and apply those.
          </p>
          <Example
            title="energy per weekday"
            setup="Every day is 9 AP, Mondays are set lighter at 6."
            steps={[
              ['Monday', <>Budget 6. Suggest will not plan more than fits.</>],
              ['Tuesday', <>Budget 9.</>],
              ['Tuesday', <>Feeling rough: tap − on Today down to 4. Only that Tuesday changes.</>],
            ]}
          />
        </Section>

        <Section title="Repeating tasks">
          <p>A repeating task is one task that comes back. There are three kinds, and they behave differently:</p>
          <ul className="space-y-1">
            <li><W>Daily, or on named days</W> (Mon/Wed/Fri) — each day&rsquo;s occurrence belongs to that day. Miss one and it is simply gone: no pressure, no rot, not a missed plan.</li>
            <li><W>Every so often, from when you last did it</W> (&ldquo;When I finish it&rdquo;) — due one interval after the last time. Do it early and the next one comes earlier. Missed cycles pile up.</li>
            <li><W>On a fixed period</W> (&ldquo;The due date&rdquo;) — a real deadline that never moves: rent on the 1st. Late is overdue like any deadline.</li>
          </ul>
          <p>
            The occurrences after the current one show faintly (↻) on Plan and Week. They cost no energy until planned.
            Tap one to <W>plan</W> it or <W>skip</W> it; a daily one can only be planned on its own day. Planned ones
            are drawn solid and count against their day. Suggest plans occurrences too: daily ones on their own day if
            there is room, the others anywhere in their window.
          </p>
          <p><W>Repeat until</W> stops a series after a date. A repeating task in a goal project stops when the goal is reached.</p>
          <Example
            title="read a page, every day, towards a book"
            setup="“Read a page” — daily, Low urgency, 1 AP, in the goal project “Read a Book” (300 pages)."
            steps={[
              ['Each morning', <>Back for the day, unplanned: <S i={35} u={20} s={7} />, and it stays 7 however many days you skip. It sits in Plan&rsquo;s Unscheduled list and costs nothing until planned.</>],
              ['Planning', <>📅 Plan on it offers just today. The faint ↻ copies on the next days can each be planned or skipped. Suggest may plan each day&rsquo;s one if that day has room.</>],
              ['Done', <>Ticking it adds 1 page to Read a Book (set a different amount in the task). Log extra pages with + Log on the project.</>],
              ['Missed', <>Skipped Tuesday? Wednesday&rsquo;s is a new one. Nothing is owed.</>],
              ['Page 300', <>The goal is reached and the task stops coming back.</>],
            ]}
          />
          <Example
            title="water the plants every 2 weeks"
            setup="“Water the plants” — every 2 weeks from when you last did it, Normal / Normal, Home (Important). Last watered Mon 5th."
            steps={[
              ['5th', <>Due on the 19th. <S i={40} u={42} s={17} /> — calm mid-cycle.</>],
              ['19th', <>Due today: <S i={40} u={62} s={25} />.</>],
              ['20th', <>A day late: <S i={40} u={66} s={26} />.</>],
              ['26th', <>A week late: <S i={40} u={78} s={31} /> — it is in the Matrix&rsquo;s Fit In now.</>],
              ['Nov 3rd', <>Two cycles missed (&ldquo;↻ 2 behind&rdquo;): <S i={40} u={79} s={32} />, and it stops there — below any real overdue deadline.</>],
              ['Early', <>Water them on the 15th instead and the next one is due the 29th.</>],
              ['Suggest', <>Last watered Fri 2nd (due Fri 16th), planning Mon 12th–Sun 18th: it goes on Monday — or Tuesday if Monday is full.</>],
            ]}
          />
          <Example
            title="rent on the 1st"
            setup="“Pay rent” — monthly, counted from the due date, Essential / High, Finance (Critical), due Nov 1."
            steps={[
              ['Oct 5th', <><S i={65} u={55} s={36} /></>],
              ['Oct 30th', <><S i={65} u={75} s={49} /> — two days to go, in Do Now.</>],
              ['Paid early', <>Paid on the 28th: it stays done through the 1st, comes back on the 2nd, due Dec 1. Paying early never drags next month earlier.</>],
              ['Nov 2nd', <>Not paid: a day overdue, <S i={65} u={90} s={59} />.</>],
            ]}
          />
          <Example
            title="gym prep, Mon/Wed/Fri"
            setup="Weekly on Monday, Wednesday and Friday."
            steps={[
              ['Missed Mon', <>Monday&rsquo;s lapses. On Tuesday the one in hand is Wednesday&rsquo;s. The score does not change.</>],
            ]}
          />
        </Section>

        <Section title="Blocked and waiting">
          <p>
            Set a task to <W>Blocked</W> and it must have either a <W>task it waits on</W> or a <W>day to chase it up</W> —
            the form will not save without one. Blocked work is hidden from every calendar and does not rot, so one of
            those is what brings it back. A task that is holding something up says so: &ldquo;Unblocks: …&rdquo;.
          </p>
          <p>
            On its chase day it appears in Today&rsquo;s &ldquo;to chase&rdquo; strip and the morning brief, and from then it
            scores like a deadline; left unchased it goes overdue. If it has a real deadline within a week, it is flagged
            <W> pressing</W> on Today and Plan.
          </p>
          <Example
            title="waiting on another task"
            setup="“Reach out to James” (High, Normal, Important) is blocked by “Budget”."
            steps={[
              ['While blocked', <>Off every calendar, <S i={50} u={30} s={15} />. Budget&rsquo;s form shows &ldquo;Unblocks: Reach out to James&rdquo;.</>],
              ['Budget done', <>James unblocks by itself and goes back to the backlog, or to its planned day.</>],
            ]}
          />
          <Example
            title="waiting on a person, with a deadline"
            setup="“Tax return docs” (High, High, Important) — waiting on the accountant, chase on Thu 8th, due Fri 16th."
            steps={[
              ['Mon 5th', <>Quiet and off the calendars: <S i={50} u={60} s={30} /> from the deadline alone.</>],
              ['Thu 8th', <>Chase day: <S i={50} u={85} s={43} />. In Today&rsquo;s &ldquo;to chase&rdquo; strip with &ldquo;Chased — a week&rdquo;, &ldquo;Tomorrow&rdquo; and &ldquo;Unblock&rdquo;.</>],
              ['Fri 9th', <>Chase a day overdue: <S i={50} u={90} s={45} />, and the deadline is now a week away, so it is flagged pressing.</>],
              ['Mon 12th', <><S i={50} u={99} s={50} /></>],
            ]}
          />
        </Section>

        <Section title="Worth a look (on Today)">
          <p>One collapsed line, only when something applies. Each item opens where you deal with it:</p>
          <ul className="space-y-1">
            <li><W>Blocked &amp; pressing</W> — blocked, with a deadline within a week.</li>
            <li><W>To triage</W> — captures that have sat in Needs Details through a weekend.</li>
            <li><W>Blocked, nothing to chase</W> — blocked with no task and no date (from before the rule above).</li>
            <li><W>From yesterday</W> — things that belonged to yesterday and were not ticked off.</li>
          </ul>
          <p>Plans you missed and things to chase have their own strips below it.</p>
        </Section>

        <Section title="Habits">
          <p>
            Daily, weekly and so on, or &ldquo;X times a week&rdquo;; optionally only on chosen days. A habit shows on Today
            on the days it is due and costs its AP there — many habits are rightly 0. Streaks count days, or target-hitting
            weeks for a weekly target. Milestones (a 7-day streak, 100 times…) are celebrated once.
          </p>
        </Section>

        <Section title="Projects and goals">
          <p>
            A <W>pile of work</W> fills up as its tasks get done (by AP). A <W>goal</W> counts what you log in its own unit —
            with a total (&ldquo;300 pages&rdquo;, showing the pace needed if you add a finish-by date) or open-ended, where it
            just tallies. Tasks in a goal add to it each time they are done.
          </p>
          <Example
            title="a book you have not picked yet"
            setup="“Read a Book” with no page count."
            steps={[
              ['Meanwhile', <>It tallies pages as you tick &ldquo;Read a page&rdquo; and log more. Nothing stops.</>],
              ['Picked one', <>Set How many to its pages (and a finish-by date if you like): it shows the percentage and &ldquo;~4 pages/day to finish by …&rdquo;.</>],
            ]}
          />
        </Section>

        <Section title="Yesterday and Review">
          <p>
            Anything ticked on <W>Yesterday</W> counts on yesterday — in the energy history, Review, streaks, and for a
            repeating task, the date its next one is counted from. &ldquo;Do it today&rdquo; moves a missed plan to today
            (a slip, as the plan did move).
          </p>
          <p>
            <W>Review</W> shows a week or month: finished and energy spent against the period before, whether the one-off
            backlog shrank, energy by day, effort by domain, what slipped, habits against how often they were due, and goals.
          </p>
        </Section>

        <Section title="Notifications">
          <p>
            The 🔔 lists what needs you now. Pushes from the Pi are kept to a few a day: one <W>morning brief</W> (today&rsquo;s
            load and everything above), <W>event reminders</W>, an <W>evening habit check</W> when habits are left, and the
            <W> weekly and monthly review</W>. Turn them on per device in Settings — on an iPhone, from the Home Screen app.
          </p>
        </Section>

        <Section title="Where your data lives">
          <p>
            One database on your Raspberry Pi, reachable only over your tailnet. Every device keeps a copy and refreshes
            every couple of seconds and whenever you come back to the app. A save only sends what you changed; if another
            device changed the same thing first, the save is refused and you see the latest instead of overwriting it.
          </p>
          <p>
            The Pi snapshots nightly. For protection against the card failing, download a backup from Settings now and
            then; restoring replaces the profile after you confirm.
          </p>
        </Section>
      </div>
    </div>
  );
}
