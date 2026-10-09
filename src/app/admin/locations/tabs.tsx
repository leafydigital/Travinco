'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const TABS = [
  { href: '/admin/locations', label: 'Locations' },
  { href: '/admin/locations/activities', label: 'Sightseeing & activities' },
  { href: '/admin/locations/distances', label: 'Distances' },
  { href: '/admin/locations/day-plans', label: 'Day plans' },
];

export function LocationTabs() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-ink-100" aria-label="Locations & Activities">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              active ? 'border-brand-700 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
