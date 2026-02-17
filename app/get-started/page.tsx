'use client';

import Link from 'next/link';

const steps = [
  {
    number: 1,
    title: 'Create a Domain',
    description: 'Domains are categories for your tasks like "Work", "Health", or "Learning". Start by creating at least one.',
    href: '/domains',
    cta: 'Go to Domains',
  },
  {
    number: 2,
    title: 'Add a Task',
    description: 'Create your first task. Give it a name and assign it to a domain.',
    href: '/tasks',
    cta: 'Go to Tasks',
  },
  {
    number: 3,
    title: 'Set Action Points',
    description: 'Action points (1-5) indicate effort level. Tasks start as "Needs Details" and auto-promote to "Backlog" once domain and action points are set. Adding a planned date promotes them to "Planned".',
    href: '/tasks',
    cta: 'Go to Tasks',
  },
  {
    number: 4,
    title: 'Create a Habit',
    description: 'Track recurring habits like exercise, reading, or meditation. Set a recurrence (daily, weekly, etc.) and mark them done from the Today page.',
    href: '/habits',
    cta: 'Go to Habits',
  },
  {
    number: 5,
    title: 'Plan Your Week',
    description: 'Use the Plan page to triage tasks that need attention, then drag tasks onto the calendar to schedule your week.',
    href: '/plan',
    cta: 'Go to Plan',
  },
];

export default function GetStartedPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Get Started</h1>
        <p className="text-[var(--muted)]">Set up LifeOS in 5 steps</p>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <div
            key={step.number}
            className="bg-[var(--card-bg)] rounded-lg p-5 flex items-start gap-4"
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold flex-shrink-0">
              {step.number}
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium mb-1">{step.title}</h3>
              <p className="text-sm text-[var(--muted)] mb-3">{step.description}</p>
              <Link
                href={step.href}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                {step.cta} &rarr;
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-[var(--card-bg)] rounded-lg">
        <p className="text-sm text-[var(--muted)]">
          You can hide this page from the sidebar in{' '}
          <Link href="/settings" className="text-blue-400 hover:text-blue-300">Settings</Link>.
        </p>
      </div>
    </div>
  );
}
