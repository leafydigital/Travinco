'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import type { NavSection, IconName } from '@/lib/admin-nav';
import {
  LayoutDashboard, Package, MapPin, Inbox, CalendarCheck, Image as ImageIcon,
  Settings, Tag, BookOpen, Users, LogOut, TrendingUp, Receipt,
  UsersRound, Database, FileText, ReceiptText, Hotel, Car, MapPinned, Landmark,
  ShieldCheck, ClipboardList, Menu, X,
  type LucideIcon,
} from 'lucide-react';
import { signOut } from '@/app/travinco_dashboard/actions';

const iconMap: Record<IconName, LucideIcon> = {
  LayoutDashboard, Package, MapPin, Inbox, CalendarCheck, ImageIcon, Settings, Tag, BookOpen, Users,
  TrendingUp, Receipt, UsersRound, Database, FileText, ReceiptText, Hotel, Car,
  MapPinned, Landmark, ShieldCheck, ClipboardList,
};

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
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    setPendingHref(null);
    setIsMobileOpen(false);
  }, [pathname]);

  const navContent = (onItemClick?: () => void) => (
    <>
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
                  (item.href !== '/travinco_dashboard' && pathname.startsWith(item.href));
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
                        if (onItemClick) onItemClick();
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

      <div className="border-t border-ink-100 p-4 bg-ink-50/40">
        <p className="truncate text-sm font-medium text-ink-800">{userName}</p>
        <p className="text-xs capitalize text-ink-400">{userRole.replace('_', ' ')}</p>
        <form action={signOut} className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-500 transition-colors hover:bg-coral-50 hover:text-coral-700 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* 1. Mobile & Tablet Top Bar (< lg) */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-navy-800 bg-navy-900 px-4 text-white lg:hidden print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="rounded-lg p-1.5 text-navy-200 hover:bg-navy-800 hover:text-white transition cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-base font-semibold text-white tracking-tight">
            Travinco Admin
          </span>
        </div>
        <span className="rounded-full bg-navy-800 border border-navy-700 px-2.5 py-0.5 text-[11px] font-medium capitalize text-navy-200">
          {userRole.replace('_', ' ')}
        </span>
      </header>

      {/* 2. Mobile & Tablet Slide-Over Drawer (< lg) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden print:hidden">
          <div
            className="fixed inset-0 bg-ink-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex h-14 items-center justify-between border-b border-navy-800 bg-navy-900 px-4">
              <span className="font-display text-base font-semibold text-white">
                Travinco Admin
              </span>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="rounded-lg p-1.5 text-navy-200 hover:bg-navy-800 hover:text-white transition cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {navContent(() => setIsMobileOpen(false))}
          </div>
        </div>
      )}

      {/* 3. Desktop Permanent Sidebar (>= lg) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-100 bg-white shadow-sm lg:flex print:hidden">
        <div className="flex h-16 items-center border-b border-ink-100 bg-navy-900 px-5">
          <span className="font-display text-lg font-semibold text-white tracking-tight">
            Travinco Admin
          </span>
        </div>
        {navContent()}
      </aside>
    </>
  );
}
