'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import type { NavSection } from '@/lib/admin-nav';
import { LogOut } from 'lucide-react';
import { signOut } from '@/app/admin/actions';

export function AdminSidebar({
  sections,
  userName,
  userRole,
}: {
  sections: NavSection[];
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-ink-100 bg-white">
      <div className="flex h-16 items-center border-b border-ink-100 px-5">
        <span className="font-display text-lg font-semibold text-brand-700">
          Wayfarer Admin
        </span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {sections.map((section, i) => (
          <div key={section.title ?? i}>
            {section.title && (
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-ink-600 hover:bg-ink-50'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-ink-100 p-4">
        <p className="truncate text-sm font-medium text-ink-800">{userName}</p>
        <p className="text-xs capitalize text-ink-400">{userRole.replace('_', ' ')}</p>
        <form action={signOut} className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-500 hover:bg-ink-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
