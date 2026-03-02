'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const [hideGetStarted, setHideGetStarted] = useState(false);

  const syncSetting = useCallback(() => {
    setHideGetStarted(localStorage.getItem('hideGetStarted') === 'true');
  }, []);

  useEffect(() => {
    syncSetting();
    window.addEventListener('storage', syncSetting);
    return () => window.removeEventListener('storage', syncSetting);
  }, [syncSetting]);

  const navItems = [
    { href: '/', icon: '📍', label: 'Today' },
    { href: '/week', icon: '📅', label: 'Week' },
    { href: '/plan', icon: '📋', label: 'Plan' },
    { type: 'divider' as const },
    { href: '/tasks', icon: '📁', label: 'Tasks' },
    { href: '/events', icon: '🕐', label: 'Events' },
    { href: '/habits', icon: '🔄', label: 'Habits' },
    { href: '/domains', icon: '🗂️', label: 'Domains' },
    { type: 'divider' as const },
    ...(!hideGetStarted ? [{ href: '/get-started', icon: '🚀', label: 'Get Started' }] : []),
    { href: '/settings', icon: '⚙️', label: 'Settings' },
    { href: '/help', icon: 'ℹ️', label: 'How it Works' },
  ];

  return (
    <aside
      className={`${
        collapsed ? 'w-14' : 'w-56'
      } h-screen bg-[#1e1e1e] border-r border-[var(--border-color)] flex flex-col fixed left-0 top-0 transition-all duration-200`}
    >
      {/* Logo + collapse toggle */}
      <div className={`${collapsed ? 'px-2 py-4 justify-center' : 'p-4 justify-between'} border-b border-[var(--border-color)] flex items-center`}>
        <button
          onClick={collapsed ? onToggleCollapse : undefined}
          className={`flex items-center gap-2 min-w-0 ${collapsed ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <span className="text-2xl flex-shrink-0">👾</span>
          {!collapsed && <span className="text-lg font-semibold text-white">LifeOS</span>}
        </button>
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="text-[var(--muted)] hover:text-white text-sm flex-shrink-0"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            ◀
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? 'p-1' : 'p-3'} space-y-1 overflow-hidden`}>
        {navItems.map((item, index) => {
          if (item.type === 'divider') {
            return <div key={index} className="my-3 border-t border-[var(--border-color)]" />;
          }

          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`flex items-center ${collapsed ? 'justify-center px-1' : 'gap-3 px-3'} py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--card-bg)] text-white'
                  : 'text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
