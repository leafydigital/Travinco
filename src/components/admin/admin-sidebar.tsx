'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import type { NavSection, IconName } from '@/lib/admin-nav';
import {
  LayoutDashboard, Package, MapPin, Inbox, CalendarCheck, Image as ImageIcon,
  Settings, Tag, BookOpen, Users, LogOut, TrendingUp, Receipt,
  UsersRound, Database, FileText, ReceiptText, Hotel, Car, MapPinned, Landmark,
  type LucideIcon,
} from 'lucide-react';
import { signOut } from '@/app/admin/actions';

// Icon components are only ever referenced here, inside a Client
// Component — admin-nav.ts (a server-safe config module) stores just the
// name string, since a live component reference can't cross the
// Server -> Client boundary as plain data.
const iconMap: Record<IconName, LucideIcon> = {
  LayoutDashboard, Package, MapPin, Inbox, CalendarCheck, ImageIcon, Settings, Tag, BookOpen, Users,
  TrendingUp, Receipt, UsersRound, Database, FileText, ReceiptText, Hotel, Car,
  MapPinned, Landmark,
};

import { useEffect, useState } from 'react';

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
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 print:hidden flex-col border-r border-ink-100 bg-white shadow-sm">
      <div className="flex h-16 items-center border-b border-ink-100 bg-navy-900 px-5">
        <span className="font-display text-lg font-semibold text-white">
          Travinco Admin
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
                const isCurrent =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href));
                const isPending = pendingHref === item.href;
                const active = isPending || (isCurrent && !pendingHref);
                const Icon = iconMap[item.icon];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch={true}
                      onClick={() => {
                        if (pathname !== item.href) {
                          setPendingHref(item.href);
                        }
                      }}
                      className={cn(
                        'flex items-center justify-between rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-all duration-150',
                        active
                          ? 'border-l-coral-500 bg-brand-50 text-brand-700 font-semibold'
                          : 'border-l-transparent text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                      )}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {isPending && (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-coral-500" />
                        </span>
                      )}
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
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-500 transition-colors hover:bg-coral-50 hover:text-coral-700"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
