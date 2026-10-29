'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { cn } from '@/lib/utils/cn';
import type { NavSection, IconName } from '@/lib/admin-nav';
import {
  LayoutDashboard, Package, MapPin, Inbox, CalendarCheck, Image as ImageIcon,
  Settings, Tag, BookOpen, Users, LogOut, TrendingUp, Receipt,
  UsersRound, Database, FileText, ReceiptText, Hotel, Car, MapPinned, Landmark,
  ShieldCheck, ClipboardList, Menu, X, Loader2, Palette, PanelLeftClose, Blocks,
  type LucideIcon,
} from 'lucide-react';
import { ResetPasswordModal } from '@/components/admin/reset-password-modal';

const iconMap: Record<IconName, LucideIcon> = {
  LayoutDashboard, Package, MapPin, Inbox, CalendarCheck, ImageIcon, Settings, Tag, BookOpen, Users,
  TrendingUp, Receipt, UsersRound, Database, FileText, ReceiptText, Hotel, Car,
  MapPinned, Landmark, ShieldCheck, ClipboardList, Palette, Blocks,
};

export function AdminSidebar({
  sections,
  userName,
  userRole,
  userEmail,
  isCollapsed = false,
  onToggleCollapse,
}: {
  sections: NavSection[];
  userName: string;
  userRole: string;
  userEmail?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Sign out in ONE request: the server clears the httpOnly session cookies and
  // redirects straight to /app (no flash of the dashboard in between).
  const handleFastSignOut = () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/auth/staff-signout';
    form.style.display = 'none';
    document.body.appendChild(form);
    form.submit();
  };

  // "Signed in" toast after arriving from the /app sign-in page
  useEffect(() => {
    try {
      if (sessionStorage.getItem('tv_staff_login_success')) {
        sessionStorage.removeItem('tv_staff_login_success');
        toast.success('Signed in successfully');
      }
    } catch {}
  }, []);

  useEffect(() => {
    setPendingHref(null);
    setIsMobileOpen(false);
  }, [pathname]);

  // Lock body scrolling on mobile/tablet when sidebar drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobileOpen]);

  // Allow closing drawer with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  const navContent = (onItemClick?: () => void) => (
    <>
      <nav className="flex-1 min-h-0 space-y-6 overflow-y-auto px-3 py-4">
        {sections.map((section, i) => (
          <div key={section.title ?? i}>
            {section.title && (
              <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                {section.title}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const normalizedHref = item.href.replace(/^\/admin/, '/travinco_dashboard');
                const isCurrent =
                  pathname === item.href ||
                  pathname === normalizedHref ||
                  (item.href !== '/travinco_dashboard' && pathname.startsWith(normalizedHref));
                const isPending = pendingHref === item.href;
                const active = isPending || (isCurrent && !pendingHref);
                const Icon = iconMap[item.icon];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (pathname !== item.href) {
                          setPendingHref(item.href);
                        }
                        if (onItemClick) onItemClick();
                      }}
                      className={cn(
                        'flex items-center justify-between rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-all duration-150 min-h-[42px]',
                        active
                          ? 'border-l-coral-500 bg-brand-50 text-brand-700 font-semibold shadow-2xs'
                          : 'border-l-transparent text-ink-600 hover:bg-ink-50 hover:text-ink-900 active:bg-ink-100'
                      )}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-600' : 'text-ink-500')} />
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

      <div className="border-t border-ink-100 p-3 bg-ink-50/70 space-y-1.5 shrink-0">

        <ResetPasswordModal userEmail={userEmail} variant="sidebar" />

        <button
          type="button"
          onClick={handleFastSignOut}
          disabled={isSigningOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-coral-50 hover:text-coral-700 cursor-pointer disabled:opacity-60"
        >
          {isSigningOut ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-coral-600 shrink-0" />
              <span className="text-coral-600 font-medium">Signing out...</span>
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4 shrink-0 text-ink-400 group-hover:text-coral-600" />
              <span>Sign out</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Instant feedback while the sign-out request redirects to /app */}
      {isSigningOut && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-white/90 backdrop-blur-sm print:hidden">
          <div className="flex items-center gap-2 text-sm font-medium text-ink-700">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            <span>Signing out…</span>
          </div>
        </div>
      )}

      {/* 1. Mobile & Tablet Top Bar (< lg) with Toggle Button */}
      <header className="sticky top-0 z-40 flex h-14 sm:h-16 w-full items-center justify-between border-b border-navy-800 bg-navy-900/95 backdrop-blur-md px-3 sm:px-5 text-white lg:hidden print:hidden">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            aria-label={isMobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileOpen}
            aria-controls="mobile-sidebar-drawer"
            className="flex h-10 items-center gap-2 rounded-xl border border-navy-700 bg-navy-800/90 px-3 text-white hover:bg-navy-700 active:scale-95 transition-all shadow-xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-brand-400"
          >
            <Menu className="h-5 w-5 shrink-0 text-brand-300" />
            <span className="text-xs font-semibold tracking-wide">
              Menu
            </span>
          </button>

          <Link
            href="/travinco_dashboard"
            className="flex items-center rounded-lg bg-white px-2.5 py-1.5 hover:opacity-90 transition"
          >
            <Image
              src="/images/green_logo.png"
              alt="Travinco"
              width={2879}
              height={768}
              priority
              className="h-6 w-auto"
            />
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-white truncate max-w-[150px]">{userName}</span>
            <span className="text-[10px] text-navy-300 capitalize">{userRole.replace('_', ' ')}</span>
          </div>
          <span className="rounded-full bg-navy-800 border border-navy-700 px-2.5 py-1 text-[11px] font-semibold capitalize text-brand-300 shadow-2xs sm:hidden">
            {userRole.replace('_', ' ')}
          </span>
          <button
            type="button"
            onClick={handleFastSignOut}
            disabled={isSigningOut}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-navy-700 bg-navy-800 text-navy-300 hover:text-coral-400 hover:bg-navy-700 transition cursor-pointer"
            title="Sign out"
            aria-label="Sign out"
          >
            {isSigningOut ? (
              <Loader2 className="h-4 w-4 animate-spin text-coral-400" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* 2. Mobile & Tablet Slide-Over Drawer (< lg) */}
      {isMobileOpen && (
        <div
          id="mobile-sidebar-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Admin Navigation Menu"
          className="fixed inset-0 z-50 flex lg:hidden print:hidden"
        >
          {/* Backdrop with blur & click to close */}
          <div
            className="fixed inset-0 bg-ink-950/70 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-out Panel */}
          <div className="relative flex w-[85vw] max-w-xs sm:w-80 h-[100dvh] max-h-[100dvh] flex-col bg-white shadow-2xl transition duration-200 ease-out animate-in slide-in-from-left z-10 overflow-hidden">
            {/* Drawer Header */}
            <div className="flex h-14 sm:h-16 items-center justify-between border-b border-ink-100 bg-white px-4 shrink-0">
              <Link href="/travinco_dashboard" onClick={() => setIsMobileOpen(false)} className="flex items-center">
                <Image
              src="/images/green_logo.png"
              alt="Travinco"
              width={2879}
              height={768}
              priority
              className="h-8 w-auto"
            />
              </Link>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-500 hover:bg-ink-50 hover:text-ink-800 active:scale-95 transition cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Navigation Content */}
            {navContent(() => setIsMobileOpen(false))}
          </div>
        </div>
      )}

      {/* 3. Desktop Permanent Sidebar (>= lg) with Animated Collapse */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-ink-100 bg-white shadow-sm lg:flex print:hidden transition-all duration-300 ease-in-out z-30 overflow-hidden',
          isCollapsed
            ? 'w-0 -translate-x-full border-r-0 opacity-0 pointer-events-none'
            : 'w-64 translate-x-0 opacity-100'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-ink-100 bg-white px-4 shrink-0">
          <Link href="/travinco_dashboard" className="flex items-center min-w-0 hover:opacity-90 transition">
            <Image
              src="/images/green_logo.png"
              alt="Travinco"
              width={2879}
              height={768}
              priority
              className="h-9 w-auto"
            />
          </Link>

          {/* Desktop Sidebar Collapse Toggle Button */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition cursor-pointer shrink-0"
              title="Collapse sidebar (Ctrl+B)"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {navContent()}
      </aside>
    </>
  );
}
