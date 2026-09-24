'use client';

/**
 * The phone's navigation: the four places you go every day, in thumb reach,
 * and everything else behind More. The desktop keeps its sidebar.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', icon: '📍', label: 'Today' },
  { href: '/plan', icon: '📋', label: 'Plan' },
  { href: '/week', icon: '📅', label: 'Week' },
  { href: '/yesterday', icon: '↩️', label: 'Yesterday' },
];

export default function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const onMain = ITEMS.some(item => item.href === pathname);

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#1e1e1e]/95 backdrop-blur border-t border-[var(--border-color)] pb-safe"
         aria-label="Main">
      <div className="grid grid-cols-5">
        {ITEMS.map(item => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
                  className={`flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] ${active ? 'text-white' : 'text-[var(--muted)]'}`}
                  aria-current={active ? 'page' : undefined}>
              <span className={`text-xl leading-none ${active ? '' : 'opacity-70'}`}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        <button onClick={onMore}
                className={`flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] ${!onMain ? 'text-white' : 'text-[var(--muted)]'}`}>
          <span className="text-xl leading-none opacity-70">☰</span>
          More
        </button>
      </div>
    </nav>
  );
}
