'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Check,
  X,
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
} from 'lucide-react';
import { createStaffUser } from './actions';
import { PAGE_CATALOG, CATEGORIES, type PageCategory } from '@/lib/admin-pages';

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

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? 'text-brand-600 font-medium' : 'text-ink-400'}`}>
      {met ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <X className="h-3.5 w-3.5 text-ink-300 shrink-0" />}
      <span>{label}</span>
    </li>
  );
}

export function UserForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // User details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');

  // Page access permissions: default to all operational pages selected
  const defaultSelectedPages = useMemo(() => {
    return new Set(
      PAGE_CATALOG.filter(
        (p) => !p.adminOnly && (p.category === 'Core Operations' || p.category === 'Tour Operations')
      ).map((p) => p.key)
    );
  }, []);

  const [selectedPages, setSelectedPages] = useState<Set<string>>(defaultSelectedPages);

  const rules = {
    length: password.length >= 7,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const allRulesMet = Object.values(rules).every(Boolean);

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role.trim()) {
      toast.error('Please enter a role or designation name.');
      return;
    }

    startTransition(async () => {
      const permissionsArray = Array.from(selectedPages);
      const result = await createStaffUser({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role: role.trim(),
        permissions: permissionsArray,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Staff user "${fullName}" created with ${permissionsArray.length} assigned pages!`);
      router.refresh();
      // Navigate directly to role management page access so admin can see user and permissions immediately
      router.push('/travinco_dashboard/role-management/page-access');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Section 1: User Account Details ── */}
      <div className="card p-6 shadow-xs space-y-5 bg-white border-ink-100">
        <div>
          <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
              1
            </span>
            Staff Member Account Details
          </h2>
          <p className="text-xs text-ink-500 mt-0.5 ml-8">
            Enter the personal and login credentials for this staff member.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-1">
          {/* Full Name */}
          <div>
            <label className="label">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input text-sm"
            />
          </div>

          {/* Email */}
          <div>
            <label className="label">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="e.g. rahul@travinco.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input text-sm"
            />
          </div>

          {/* Custom Role / Designation (No predefined Sales/Accounts dropdown) */}
          <div className="sm:col-span-2">
            <label className="label flex items-center justify-between">
              <span>
                User Role / Designation <span className="text-red-500">*</span>
              </span>
              <span className="text-xs font-normal text-ink-400">
                Enter any custom title (no predefined role required)
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

          {/* Password */}
          <div className="sm:col-span-2">
            <label className="label">
              Temporary Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set a secure temporary password"
              className="input text-sm"
            />
            <ul className="mt-2.5 grid grid-cols-2 sm:grid-cols-5 gap-2 rounded-lg bg-ink-50/70 p-3 border border-ink-100">
              <PasswordRule met={rules.length} label="7+ characters" />
              <PasswordRule met={rules.upper} label="1 uppercase" />
              <PasswordRule met={rules.lower} label="1 lowercase" />
              <PasswordRule met={rules.number} label="1 number" />
              <PasswordRule met={rules.symbol} label="1 symbol" />
            </ul>
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
              Assign Page & Module Access Permissions
            </h2>
            <p className="text-xs text-ink-500 mt-0.5 ml-8">
              Select which pages will appear in this staff member&apos;s sidebar. Unchecked pages remain completely hidden and restricted.
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
            {selectedPages.size === 0 ? 'User will have no accessible pages' : 'Sidebar will render granted items only'}
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
          User account will be provisioned and assigned permissions will take effect immediately.
        </p>

        <button
          type="submit"
          disabled={isPending || !allRulesMet || !fullName.trim() || !email.trim() || !role.trim()}
          className="btn-primary px-6 py-2.5 text-sm font-semibold shadow-sm shrink-0"
        >
          {isPending ? 'Creating User & Saving Permissions…' : 'Create User & Assign Permissions'}
        </button>
      </div>
    </form>
  );
}
