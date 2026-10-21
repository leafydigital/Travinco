'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { AdminNavProgress } from './admin-nav-progress';
import { PanelLeftOpen } from 'lucide-react';
import type { NavSection } from '@/lib/admin-nav';
import { cn } from '@/lib/utils/cn';

interface AdminDashboardLayoutProps {
  sections: NavSection[];
  userName: string;
  userRole: string;
  userEmail?: string;
  children: React.ReactNode;
}

export function AdminDashboardLayout({
  sections,
  userName,
  userRole,
  userEmail,
  children,
}: AdminDashboardLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  // Restore collapsed preference from localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('travinco_sidebar_collapsed');
      if (stored === 'true') {
        setIsCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('travinco_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        // Avoid conflict if typing in input or textarea
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-ink-50 print:block print:bg-white relative">
      <AdminNavProgress />

      {/* Admin Sidebar with animated collapse */}
      <AdminSidebar
        sections={sections}
        userName={userName}
        userRole={userRole}
        userEmail={userEmail}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      {/* Floating Toggle Button when Sidebar is Collapsed on Desktop */}
      {mounted && isCollapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden lg:flex fixed left-4 top-4 z-40 items-center gap-2 rounded-xl border border-ink-200 bg-white/95 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-ink-800 shadow-md hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 hover:shadow-lg active:scale-95 transition-all cursor-pointer group animate-in fade-in slide-in-from-left duration-200"
          title="Expand sidebar (Ctrl+B)"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4 text-brand-600 group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-ink-700 group-hover:text-brand-800">
            Show Sidebar
          </span>
          <kbd className="ml-1 rounded bg-sand-100 px-1.5 py-0.5 text-[10px] text-ink-400 group-hover:bg-brand-100 group-hover:text-brand-800">
            Ctrl+B
          </kbd>
        </button>
      )}

      {/* Main Content Area: Expands to full screen width when collapsed! */}
      <div className="flex-1 min-w-0 overflow-x-hidden transition-all duration-300 ease-in-out">
        <main
          className={cn(
            'mx-auto px-3.5 py-4 sm:px-6 sm:py-6 lg:px-8 print:max-w-none print:p-0 transition-all duration-300',
            isCollapsed
              ? 'w-full max-w-none lg:pt-16' // Full screen layout with clearance for floating toggle
              : 'max-w-7xl' // Standard width
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
