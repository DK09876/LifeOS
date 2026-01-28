'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', icon: '📍', label: 'Today' },
  { href: '/week', icon: '📅', label: 'Week' },
  { href: '/plan', icon: '📋', label: 'Plan' },
  { type: 'divider' as const },
  { href: '/tasks', icon: '📁', label: 'Tasks' },
  { href: '/domains', icon: '🗂️', label: 'Domains' },
  { type: 'divider' as const },
  { href: '/help', icon: 'ℹ️', label: 'How it Works' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 h-screen bg-[#1e1e1e] border-r border-[var(--border-color)] flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👾</span>
          <span className="text-lg font-semibold text-white">LifeOS</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item, index) => {
          if (item.type === 'divider') {
            return <div key={index} className="my-3 border-t border-[var(--border-color)]" />;
          }

          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--card-bg)] text-white'
                  : 'text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
