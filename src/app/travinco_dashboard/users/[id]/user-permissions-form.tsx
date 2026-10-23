'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ShieldCheck,
  CheckSquare,
  Square,
  Briefcase,
  LayoutDashboard,
  Package,
  MapPin,
  Inbox,
  CalendarCheck,
  UsersRound,
  FileText,
  ReceiptText,
  Hotel,
  Car,
  MapPinned,
  Landmark,
  Tag,
  Image as ImageIcon,
  BookOpen,
  TrendingUp,
  Receipt,
  Database,
  Settings,
  Users,
  type LucideIcon,
  RotateCcw,
  Power,
  PowerOff,
  Save,
} from 'lucide-react';
import { updateStaffRole, setStaffActive } from '../actions';
import { saveStaffPagePermissions } from '@/app/travinco_dashboard/role-management/actions';
import { PAGE_CATALOG, CATEGORIES, type PageCategory } from '@/lib/admin-pages';
import type { Tables } from '@/types/database';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  MapPin,
  Inbox,
  CalendarCheck,
  UsersRound,
  FileText,
  ReceiptText,
  Hotel,
  Car,
  MapPinned,
  Landmark,
  Tag,
  ImageIcon,
  BookOpen,
  TrendingUp,
  Receipt,
  Database,
  Settings,
  ShieldCheck,
  Users,
};

export function UserPermissionsForm({
  userId,
  userName,
  userEmail,
  currentRole,
  isActive,
  isSelf,
  existingPermissions,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  currentRole: string;
  isActive: boolean;
  isSelf: boolean;
  existingPermissions: Tables<'staff_permissions'>[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Role & Active Status
  const [role, setRole] = useState(currentRole);
  const [active, setActive] = useState(isActive);

  // Initialize selected pages from existing permissions
  const initialPages = useMemo(() => {
    const set = new Set<string>();
    if (existingPermissions.length > 0) {
      for (const p of existingPermissions) {
        if (p.can_view && p.module !== '__none__') {
          set.add(p.module);
        }
      }
    } else {
      // Default to operational pages if no custom permissions configured yet
      for (const p of PAGE_CATALOG) {
        if (!p.adminOnly && (p.category === 'Core Operations' || p.category === 'Tour Operations')) {
          set.add(p.key);
        }
      }
    }
    return set;
  }, [existingPermissions]);

  const [selectedPages, setSelectedPages] = useState<Set<string>>(initialPages);

  // Toggle single page
  function togglePage(key: string) {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // Toggle category
  function toggleCategory(cat: PageCategory) {
    const catPages = PAGE_CATALOG.filter((p) => p.category === cat);
    const allSelected = catPages.every((p) => selectedPages.has(p.key));

    setSelectedPages((prev) => {
      const next = new Set(prev);
      for (const p of catPages) {
        if (allSelected) {
          next.delete(p.key);
        } else {
          next.add(p.key);
        }
      }
      return next;
    });
  }

  // Quick selects
  function selectAll() {
    setSelectedPages(new Set(PAGE_CATALOG.map((p) => p.key)));
  }

  function selectOperational() {
    setSelectedPages(
      new Set(
        PAGE_CATALOG.filter(
          (p) => p.category === 'Core Operations' || p.category === 'Tour Operations'
        ).map((p) => p.key)
      )
    );
  }

  function clearAll() {
    setSelectedPages(new Set());
  }

  // Handle active status toggle
  function handleToggleActive() {
    if (isSelf && active) {
      toast.error('You cannot deactivate your own account.');
      return;
    }

    const nextState = !active;
    setActive(nextState);
    startTransition(async () => {
      const res = await setStaffActive(userId, nextState);
      if (res.error) {
        toast.error(res.error);
        setActive(!nextState);
      } else {
        toast.success(nextState ? `Activated account for ${userName}` : `Deactivated account for ${userName}`);
        router.refresh();
      }
    });
  }

  // Save all changes (role & permissions)
  function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    if (!role.trim()) {
      toast.error('Please enter a role or designation name.');
      return;
    }

    startTransition(async () => {
      // 1. Update role designation
      const roleRes = await updateStaffRole(userId, role.trim());
      if (roleRes.error) {
        toast.error(roleRes.error);
        return;
      }

      // 2. Save page access permissions
      const permissionsArray = Array.from(selectedPages);
      const permRes = await saveStaffPagePermissions(userId, permissionsArray);
      if (permRes.error) {
        toast.error(permRes.error);
        return;
      }

      toast.success(`Updated details and permissions for ${userName}!`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSaveAll} className="space-y-6">
      {/* ── Section 1: Staff Account & Role Designation ── */}
      <div className="card p-6 shadow-xs space-y-5 bg-white border-ink-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                1
              </span>
              Staff Member Details & Role
            </h2>
            <p className="text-xs text-ink-500 mt-0.5 ml-8">
              {userEmail} • {active ? 'Account active' : 'Account deactivated'}
            </p>
          </div>

          {/* Account Status Toggle */}
          {!isSelf && (
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={isPending}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border ${
                active
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {active ? (
                <>
                  <PowerOff className="h-3.5 w-3.5" />
                  Deactivate Account
                </>
              ) : (
                <>
                  <Power className="h-3.5 w-3.5" />
                  Activate Account
                </>
              )}
            </button>
          )}
        </div>

        {/* Custom Role / Designation (No predefined dropdowns) */}
        <div>
          <label className="label flex items-center justify-between">
            <span>
              Role / Designation <span className="text-red-500">*</span>
            </span>
            <span className="text-xs font-normal text-ink-400">
              Type custom role title
            </span>
          </label>
          <input
            type="text"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Tour Coordinator, Holiday Planner, Reservation Lead, Manager"
            className="input text-sm"
          />
          {/* Suggestion Pills */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-ink-400">Suggestions:</span>
            {[
              'Tour Coordinator',
              'Travel Consultant',
              'Operations Lead',
              'Reservation Specialist',
              'Holiday Planner',
              'Account Manager',
              'Administrator',
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setRole(suggestion)}
                className={`rounded-md border px-2.5 py-0.5 text-xs transition-colors ${
                  role.toLowerCase() === suggestion.toLowerCase()
                    ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700'
                    : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 2: Page Access & Module Permissions ── */}
      <div className="card p-6 shadow-xs space-y-6 bg-white border-ink-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                2
              </span>
              Assigned Page & Module Access Permissions
            </h2>
            <p className="text-xs text-ink-500 mt-0.5 ml-8">
              Pages selected here will appear in {userName}&apos;s sidebar navigation. Unselected pages are completely hidden.
            </p>
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={selectAll}
              className="btn-outline text-xs py-1 px-2.5 h-8 flex items-center gap-1.5"
            >
              <CheckSquare className="h-3.5 w-3.5 text-brand-600" />
              Select All
            </button>
            <button
              type="button"
              onClick={selectOperational}
              className="btn-outline text-xs py-1 px-2.5 h-8 flex items-center gap-1.5"
            >
              <Briefcase className="h-3.5 w-3.5 text-amber-500" />
              Operational Only
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="btn-outline text-xs py-1 px-2.5 h-8 flex items-center gap-1.5 text-ink-600 hover:text-red-600"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Selected count badge */}
        <div className="flex items-center justify-between bg-brand-50/60 border border-brand-100 rounded-lg px-4 py-2.5 text-xs text-brand-900">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-brand-600" />
            <span>
              <strong>{selectedPages.size}</strong> of {PAGE_CATALOG.length} pages granted access
            </span>
          </div>
          <span className="text-[11px] text-brand-700">
            Permissions stay 100% in sync with Page Access Management
          </span>
        </div>

        {/* Categories Checkbox Grid */}
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const pages = PAGE_CATALOG.filter((p) => p.category === cat);
            if (pages.length === 0) return null;

            const selectedCount = pages.filter((p) => selectedPages.has(p.key)).length;
            const allCatSelected = selectedCount === pages.length;

            return (
              <div key={cat} className="rounded-xl border border-ink-100 bg-ink-50/30 p-4 space-y-3">
                {/* Category Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-700">
                      {cat}
                    </span>
                    <span className="rounded-full bg-white border border-ink-200 px-2 py-0.2 text-[10px] font-semibold text-ink-500">
                      {selectedCount}/{pages.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="text-xs font-medium text-brand-700 hover:text-brand-900 flex items-center gap-1 transition-colors"
                  >
                    {allCatSelected ? (
                      <>
                        <Square className="h-3 w-3" />
                        Deselect category
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-3 w-3 text-brand-600" />
                        Select category
                      </>
                    )}
                  </button>
                </div>

                {/* Grid of Compact Checkboxes */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {pages.map((page) => {
                    const isChecked = selectedPages.has(page.key);
                    const IconComponent = iconMap[page.icon] || LayoutDashboard;

                    return (
                      <label
                        key={page.key}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'border-brand-300 bg-white shadow-2xs ring-1 ring-brand-400/40 text-ink-900'
                            : 'border-ink-150 bg-white/70 hover:bg-white hover:border-ink-300 text-ink-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePage(page.key)}
                          className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <IconComponent
                              className={`h-4 w-4 shrink-0 ${
                                isChecked ? 'text-brand-600' : 'text-ink-400'
                              }`}
                            />
                            <span className="font-semibold text-xs truncate">
                              {page.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-400 line-clamp-1 mt-0.5">
                            {page.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Submit Button Bar ── */}
      <div className="card p-4 bg-white border-ink-100 flex items-center justify-between gap-4">
        <p className="text-xs text-ink-500">
          Changes will update {userName}&apos;s sidebar navigation and page permissions immediately.
        </p>

        <button
          type="submit"
          disabled={isPending || !role.trim()}
          className="btn-primary px-6 py-2.5 text-sm font-semibold shadow-sm shrink-0 flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isPending ? 'Saving Changes…' : 'Save User Details & Permissions'}
        </button>
      </div>
    </form>
  );
}
