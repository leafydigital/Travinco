'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search,
  ShieldCheck,
  CheckSquare,
  Square,
  RotateCcw,
  Bookmark,
  Lock,
  Save,
  Users,
  AlertCircle,
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
  type LucideIcon,
} from 'lucide-react';
import { PAGE_CATALOG, CATEGORIES } from '@/lib/admin-pages';
import { saveStaffPagePermissions, resetStaffPagePermissions } from '../actions';
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

type StaffUser = Pick<
  Tables<'profiles'>,
  'id' | 'full_name' | 'email' | 'phone' | 'role' | 'role_title' | 'is_active' | 'last_login_at' | 'created_at'
>;

interface PageAccessClientProps {
  staffList: StaffUser[];
  initialPermissions: Tables<'staff_permissions'>[];
  currentAdminRole: string;
}

export function PageAccessClient({
  staffList,
  initialPermissions,
}: PageAccessClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Selected staff user
  const [selectedUserId, setSelectedUserId] = useState<string>(staffList[0]?.id ?? '');

  // Search filter for staff list
  const [searchQuery, setSearchQuery] = useState('');

  // Permissions state keyed by profileId -> Set of allowed page keys
  const permissionsByProfile = useMemo(() => {
    const map = new Map<string, { isCustom: boolean; pages: Set<string> }>();

    for (const staff of staffList) {
      const userPerms = initialPermissions.filter((p) => p.profile_id === staff.id);
      if (userPerms.length > 0) {
        // Has explicit custom permissions saved
        const allowed = new Set<string>();
        for (const p of userPerms) {
          if (p.can_view && p.module !== '__none__') {
            allowed.add(p.module);
          }
        }
        map.set(staff.id, { isCustom: true, pages: allowed });
      } else {
        // Default role allowance baseline
        const allowed = new Set<string>();
        for (const page of PAGE_CATALOG) {
          if (page.defaultRoles.includes(staff.role)) {
            allowed.add(page.key);
          }
        }
        map.set(staff.id, { isCustom: false, pages: allowed });
      }
    }

    return map;
  }, [staffList, initialPermissions]);

  // Working state for active editing session: profileId -> Set of selected pageKeys
  const [workingSelections, setWorkingSelections] = useState<Map<string, Set<string>>>(() => {
    const initial = new Map<string, Set<string>>();
    for (const [id, data] of permissionsByProfile.entries()) {
      initial.set(id, new Set(data.pages));
    }
    return initial;
  });


  // Synchronize selections and selection if staff list changes
  useState(() => {
    if (staffList[0]?.id && !selectedUserId) {
      setSelectedUserId(staffList[0].id);
    }
  });

  const selectedStaff = staffList.find((s) => s.id === selectedUserId) ?? staffList[0];

  const currentSelectedPages = useMemo(() => {
    if (!selectedStaff) return new Set<string>();
    return workingSelections.get(selectedStaff.id) ?? new Set<string>();
  }, [workingSelections, selectedStaff]);

  const originalPages = useMemo(() => {
    if (!selectedStaff) return new Set<string>();
    return permissionsByProfile.get(selectedStaff.id)?.pages ?? new Set<string>();
  }, [permissionsByProfile, selectedStaff]);

  const isCustomConfigured = useMemo(() => {
    if (!selectedStaff) return false;
    return permissionsByProfile.get(selectedStaff.id)?.isCustom ?? false;
  }, [permissionsByProfile, selectedStaff]);

  // Check if current user has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!selectedStaff) return false;
    if (currentSelectedPages.size !== originalPages.size) return true;
    for (const key of currentSelectedPages) {
      if (!originalPages.has(key)) return true;
    }
    return false;
  }, [currentSelectedPages, originalPages, selectedStaff]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        staff.full_name.toLowerCase().includes(q) ||
        staff.email.toLowerCase().includes(q) ||
        staff.role.toLowerCase().includes(q)
      );
    });
  }, [staffList, searchQuery]);

  // Toggle a single page key
  function handleTogglePage(pageKey: string, adminOnly?: boolean) {
    if (!selectedStaff) return;
    if (adminOnly && selectedStaff.role !== 'admin') {
      toast.warning('This page is strictly reserved for administrative accounts.');
      return;
    }

    setWorkingSelections((prev) => {
      const nextMap = new Map(prev);
      const current = new Set(nextMap.get(selectedStaff.id) ?? []);
      if (current.has(pageKey)) {
        current.delete(pageKey);
      } else {
        current.add(pageKey);
      }
      nextMap.set(selectedStaff.id, current);
      return nextMap;
    });
  }

  // Bulk actions
  function handleSelectAll() {
    if (!selectedStaff) return;
    const all = new Set<string>();
    for (const page of PAGE_CATALOG) {
      if (page.adminOnly && selectedStaff.role !== 'admin') continue;
      all.add(page.key);
    }
    setWorkingSelections((prev) => new Map(prev).set(selectedStaff.id, all));
  }

  function handleDeselectAll() {
    if (!selectedStaff) return;
    setWorkingSelections((prev) => new Map(prev).set(selectedStaff.id, new Set<string>()));
  }

  function applyPreset(presetType: 'sales' | 'accounts' | 'tour_ops') {
    if (!selectedStaff) return;
    const set = new Set<string>();

    if (presetType === 'sales') {
      const keys = [
        'dashboard', 'packages', 'destinations', 'enquiries', 'bookings',
        'customers', 'offers', 'events', 'gallery', 'blog',
        'quotations', 'invoices', 'hotels', 'transport', 'pickup_points', 'locations',
      ];
      keys.forEach((k) => set.add(k));
    } else if (presetType === 'accounts') {
      const keys = ['dashboard', 'income', 'expenses', 'bookings', 'customers', 'quotations', 'invoices'];
      keys.forEach((k) => set.add(k));
    } else if (presetType === 'tour_ops') {
      const keys = ['dashboard', 'quotations', 'invoices', 'hotels', 'transport', 'pickup_points', 'locations'];
      keys.forEach((k) => set.add(k));
    }

    setWorkingSelections((prev) => new Map(prev).set(selectedStaff.id, set));
    toast.info(`Applied ${presetType.replace('_', ' ')} preset.`);
  }

  function handleResetToDefault() {
    if (!selectedStaff) return;
    startTransition(async () => {
      const res = await resetStaffPagePermissions(selectedStaff.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Reset permissions for ${selectedStaff.full_name} to default role baseline.`);
        router.refresh();
      }
    });
  }

  function handleSave() {
    if (!selectedStaff) return;
    const pageKeys = Array.from(currentSelectedPages);

    startTransition(async () => {
      const res = await saveStaffPagePermissions(selectedStaff.id, pageKeys);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Page access permissions saved for ${selectedStaff.full_name}!`);
        router.refresh();
      }
    });
  }

  if (staffList.length === 0) {
    return (
      <div className="card p-12 text-center">
        <Users className="mx-auto h-12 w-12 text-ink-300" />
        <h2 className="mt-3 text-lg font-semibold text-ink-900">No staff accounts found</h2>
        <p className="mt-1 text-sm text-ink-500">
          Create staff members in the Staff Users section first to manage their page access.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* ── Left Column: Staff Users List (4 cols) ────────────────────── */}
      <div className="lg:col-span-4">
        <div className="card divide-y divide-ink-100 overflow-hidden shadow-xs">
          {/* Search & Filter Header */}
          <div className="p-3.5 space-y-2.5 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Staff Members ({filteredStaff.length})
              </span>
              <span className="text-xs text-ink-400">Click to configure</span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                placeholder="Search staff by name, email or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10 text-xs"
              />
            </div>
          </div>

          {/* Staff Member List */}
          <div className="max-h-[580px] divide-y divide-ink-50 overflow-y-auto">
            {filteredStaff.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-400">No staff matches your filter.</div>
            ) : (
              filteredStaff.map((staff) => {
                const isSelected = staff.id === selectedUserId;
                const staffPages = workingSelections.get(staff.id) ?? new Set();

                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => setSelectedUserId(staff.id)}
                    className={`w-full text-left p-3 transition-all flex items-center gap-3 border-l-4 ${
                      isSelected
                        ? 'border-l-brand-600 bg-brand-50/50 text-ink-900'
                        : 'border-l-transparent bg-white hover:bg-ink-50/60 text-ink-700'
                    }`}
                  >
                    {/* Initials Avatar */}
                    <div
                      className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center font-semibold text-xs ${
                        staff.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : staff.role === 'accounts_staff'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-brand-100 text-brand-700'
                      }`}
                    >
                      {staff.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-semibold text-xs text-ink-900">
                          {staff.full_name}
                        </span>
                        <span className="text-[11px] font-medium text-ink-500 shrink-0">
                          {staffPages.size} pages
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <p className="truncate text-[11px] text-ink-400">{staff.email}</p>
                        <span className="text-[10px] text-ink-500 capitalize shrink-0">
                          {staff.role_title || (staff.role === 'admin' ? 'Admin' : 'Staff')}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Right Column: Compact UI-Friendly Page Access Checkboxes (8 cols) ── */}
      <div className="lg:col-span-8 space-y-4">
        {selectedStaff && (
          <>
            {/* Header Card for Selected Staff with Quick Presets */}
            <div className="card p-4 bg-white shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center font-bold text-xs ${
                      selectedStaff.role === 'admin'
                        ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-200'
                        : selectedStaff.role === 'accounts_staff'
                        ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200'
                        : 'bg-brand-100 text-brand-700 ring-2 ring-brand-200'
                    }`}
                  >
                    {selectedStaff.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-ink-900">{selectedStaff.full_name}</h2>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${
                          selectedStaff.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : selectedStaff.role === 'accounts_staff'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-brand-100 text-brand-800'
                        }`}
                      >
                        {(selectedStaff.role_title || (selectedStaff.role === 'admin' ? 'Admin' : 'Staff'))}
                      </span>
                    </div>
                    <p className="text-xs text-ink-400">
                      {selectedStaff.email} • {isCustomConfigured ? 'Custom page access' : 'Default role baseline'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {hasUnsavedChanges && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200 animate-pulse">
                      <AlertCircle className="h-3 w-3" />
                      Unsaved
                    </span>
                  )}
                  {isCustomConfigured && (
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50 transition-colors"
                      title="Reset back to default role baseline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Presets & Bulk Select Toolbar */}
              <div className="pt-2.5 border-t border-ink-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-ink-500">Presets:</span>
                  <button
                    type="button"
                    onClick={() => applyPreset('sales')}
                    className="inline-flex items-center gap-1 rounded border border-ink-200 bg-ink-50 px-2 py-0.5 font-medium text-ink-700 hover:bg-ink-100 transition-colors"
                  >
                    <Bookmark className="h-3 w-3 text-brand-600" />
                    Sales Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('accounts')}
                    className="inline-flex items-center gap-1 rounded border border-ink-200 bg-ink-50 px-2 py-0.5 font-medium text-ink-700 hover:bg-ink-100 transition-colors"
                  >
                    <Bookmark className="h-3 w-3 text-emerald-600" />
                    Accounts Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('tour_ops')}
                    className="inline-flex items-center gap-1 rounded border border-ink-200 bg-ink-50 px-2 py-0.5 font-medium text-ink-700 hover:bg-ink-100 transition-colors"
                  >
                    <Bookmark className="h-3 w-3 text-purple-600" />
                    Tour Ops
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="inline-flex items-center gap-1 text-brand-600 hover:underline font-medium"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Select All
                  </button>
                  <span className="text-ink-300">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="inline-flex items-center gap-1 text-ink-500 hover:underline font-medium"
                  >
                    <Square className="h-3.5 w-3.5" />
                    Deselect All
                  </button>
                </div>
              </div>
            </div>

            {/* Compact, Short, UI-Friendly Checkbox Grid */}
            <div className="space-y-3">
              {CATEGORIES.map((category) => {
                const categoryPages = PAGE_CATALOG.filter((p) => p.category === category);
                if (categoryPages.length === 0) return null;

                const categoryCheckedCount = categoryPages.filter((p) =>
                  currentSelectedPages.has(p.key)
                ).length;
                const allCategoryChecked = categoryPages.every((p) =>
                  currentSelectedPages.has(p.key)
                );

                return (
                  <div key={category} className="card overflow-hidden shadow-2xs">
                    {/* Category Header Bar */}
                    <div className="flex items-center justify-between bg-ink-50/70 px-3.5 py-1.5 border-b border-ink-100">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-700">
                          {category}
                        </span>
                        <span className="rounded-full bg-ink-200/80 px-1.5 py-0.2 text-[10px] font-semibold text-ink-700">
                          {categoryCheckedCount}/{categoryPages.length}
                        </span>
                      </div>

                      {/* Quick Section Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          setWorkingSelections((prev) => {
                            const next = new Map(prev);
                            const current = new Set(next.get(selectedStaff.id) ?? []);
                            categoryPages.forEach((p) => {
                              if (p.adminOnly && selectedStaff.role !== 'admin') return;
                              if (allCategoryChecked) current.delete(p.key);
                              else current.add(p.key);
                            });
                            next.set(selectedStaff.id, current);
                            return next;
                          });
                        }}
                        className="text-[11px] text-brand-600 hover:text-brand-700 hover:underline font-medium"
                      >
                        {allCategoryChecked ? 'Deselect section' : 'Select section'}
                      </button>
                    </div>

                    {/* Compact Checkbox Tiles (3 cols on desktop, 2 cols on mobile) */}
                    <div className="grid grid-cols-1 gap-1.5 p-2 sm:grid-cols-2 md:grid-cols-3">
                      {categoryPages.map((page) => {
                        const isChecked = currentSelectedPages.has(page.key);
                        const isLocked = page.adminOnly && selectedStaff.role !== 'admin';
                        const IconComponent = iconMap[page.icon] ?? LayoutDashboard;

                        return (
                          <label
                            key={page.key}
                            onClick={(e) => {
                              e.preventDefault();
                              if (!isLocked) handleTogglePage(page.key, page.adminOnly);
                            }}
                            className={`flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-xs transition-all select-none ${
                              isLocked
                                ? 'cursor-not-allowed border-ink-100 bg-ink-50/60 opacity-60'
                                : isChecked
                                ? 'cursor-pointer border-brand-400 bg-brand-50/50 text-brand-950 font-semibold shadow-2xs'
                                : 'cursor-pointer border-ink-200/80 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isLocked}
                              readOnly
                              className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500 pointer-events-none"
                            />
                            <IconComponent
                              className={`h-4 w-4 shrink-0 ${
                                isChecked ? 'text-brand-600' : 'text-ink-400'
                              }`}
                            />
                            <span className="truncate flex-1 font-medium">
                              {page.label}
                            </span>
                            {isLocked && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-ink-200 px-1 py-0.2 text-[9px] font-medium text-ink-600 shrink-0">
                                <Lock className="h-2.5 w-2.5" />
                                Admin
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Save Bar */}
            <div className="sticky bottom-3 z-20 rounded-xl border border-ink-200 bg-white/95 p-3 shadow-md backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-900">
                      {currentSelectedPages.size} of {PAGE_CATALOG.length} pages granted
                    </p>
                    <p className="text-[11px] text-ink-400">
                      Only checked pages appear in {selectedStaff.full_name}&apos;s sidebar.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {hasUnsavedChanges && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setWorkingSelections((prev) =>
                          new Map(prev).set(selectedStaff.id, new Set(originalPages))
                        );
                      }}
                      className="btn-secondary text-xs px-2.5 py-1.5"
                    >
                      Discard
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending}
                    className="btn-primary text-xs px-3.5 py-1.5 inline-flex items-center gap-1.5 shadow-xs font-semibold"
                  >
                    {isPending ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        Save Page Access
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
