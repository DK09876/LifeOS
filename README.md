# LifeOS

A self-hosted personal productivity app — tasks, habits, events and projects —
running on a Raspberry Pi on your own network. No cloud account, no third
party, and the database is a file you can pick up and take with you.

It is also the app the [pantry](https://github.com/DK09876/pantry) voice
assistant drives, so a task added out loud in the kitchen shows up in the
browser a couple of seconds later.

## The idea

Most task apps have one "priority" field, which quietly conflates two
different questions: *how much does this matter* and *how soon*. LifeOS keeps
them apart.

```
importance = task priority + domain priority          20–80
urgency    = urgency field + time pressure            10–120
score      = importance × urgency / 100
```

Multiplied rather than added, so something both important and urgent pulls
clearly ahead of something that is a bit of each. Recalculated daily, so an
approaching deadline actually moves a task up the list instead of leaving it
frozen at the score it had when written.

**Time pressure** comes from a deadline if there is one, and from neglect if
there is not:

| | |
|---|---|
| Due today / tomorrow / this week | +45 / +40 / +25 |
| Overdue | +50 the first day, climbing to +70 past a month |
| No due date, untouched for 2 weeks / 1 month / 3 months | +5 / +10 / +20 |

A real deadline still beats a vague intention — but a task you have ignored
for three months is more pressing than one due in three months, and without
the second ladder undated work could never rise however long it rotted.

## What's in it

**Today** — habits, events and tasks for today, an effort meter for the day,
and a strip for plans whose day has passed asking what you want to do about
each one.

**Week** — seven days. A task appears once: on the day you planned it, or on
its due date if you have not planned it, drawn dashed so a deadline looks
different from a commitment. Finished work stays put, greyed.

**Plan** — triage what needs attention, drag unscheduled tasks onto a
day/week/month calendar, or let auto-suggest fill a week within a daily effort
budget. Plus an Eisenhower matrix over the two scoring axes.

**Tasks** — the full table: search, multi-select filters, column control,
saved presets.

**Projects** group tasks with AP-weighted progress. **Habits** recur on a
cadence or a weekly target, with streaks and a 30-day history. **Domains** are
life areas whose priority feeds every task's importance.

Tasks promote themselves: give one a name and it waits in *Needs Details*;
fill in priority, urgency, domain and an effort estimate and it becomes
*Backlog*, or *Planned* once it has a date.

## Running it

```bash
npm install
npm run dev            # http://localhost:3000
```

The database is created on first run. Add a profile before using the app:

```bash
node scripts/user.cjs add dk "DK"
```

| Variable | Default | |
|---|---|---|
| `LIFEOS_DB_PATH` | `./data/lifeos.db` | where the SQLite file lives |

```bash
npm run build && npm start   # production
npm test                     # vitest
npm run lint
```

## On the Pi

Runs under systemd and is published to the tailnet with Tailscale Serve, so
it is reachable from a phone or laptop without opening anything to the
internet. A timer snapshots the database nightly, skipping unchanged nights
and verifying what it wrote.

Snapshots share the SD card with the database, so they do not protect against
the card failing — **Settings → Your data** downloads everything as a single
JSON file, and restores one. The app reminds you monthly.

## Tech

Next.js 16 (App Router), React 19, Tailwind 4, TypeScript. SQLite through
`node-sqlite3-wasm` — the native addon segfaults on Debian 13 aarch64. Dates
via date-fns, charts via Recharts.

Installable as a PWA and works at phone width.

## License

MIT — see LICENSE.
