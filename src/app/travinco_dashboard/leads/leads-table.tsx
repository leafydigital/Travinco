'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDate } from '@/lib/utils/format';
import { Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckSquare, Square, MinusSquare } from 'lucide-react';
import { LeadStatusSelect, LeadRowActions } from './lead-row-actions';
import { bulkDeleteLeads, bulkUpdateLeadStatus, type LeadStatus } from './actions';
import { DeleteConfirmModal } from './delete-confirm-modal';
import { toast } from 'sonner';

export interface LeadItem {
  id: string;
  contact_name: string;
  contact_number: string;
  email: string | null;
  package: string | null;
  number_of_days: number | null;
  budget: number | null;
  from_date: string | null;
  to_date: string | null;
  number_of_people: number | null;
  status: LeadStatus;
  created_at: string;
}

interface Props {
  leads: LeadItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  isAdmin: boolean;
}

export function LeadsTable({ leads, totalCount, currentPage, pageSize, isAdmin }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startRow = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalCount);

  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const someSelected = leads.some((l) => selectedIds.has(l.id)) && !allSelected;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  }

  function toggleRow(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function handleBulkStatus(status: LeadStatus) {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    startBulkTransition(async () => {
      const res = await bulkUpdateLeadStatus(ids, status);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Updated status for ${ids.length} leads`);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  function executeBulkDelete() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);

    startBulkTransition(async () => {
      const res = await bulkDeleteLeads(ids);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted ${ids.length} lead(s)`);
      setSelectedIds(new Set());
      setIsBulkDeleteOpen(false);
      router.refresh();
    });
  }

  function buildPageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    return `?${params.toString()}`;
  }

  // Generate pagination page numbers
  function getPaginationPages() {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  return (
    <div className="card overflow-hidden">
      {/* Bulk actions banner */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200 bg-brand-50/70 px-4 py-2.5 text-xs text-brand-900 transition">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{selectedIds.size}</span>
            <span>lead{selectedIds.size !== 1 ? 's' : ''} selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-500">Change Status:</span>
            <button
              type="button"
              disabled={isBulkPending}
              onClick={() => handleBulkStatus('fresh_lead')}
              className="rounded bg-blue-100 px-2 py-1 font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50"
            >
              Fresh
            </button>
            <button
              type="button"
              disabled={isBulkPending}
              onClick={() => handleBulkStatus('follow_up')}
              className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-700 hover:bg-amber-200 disabled:opacity-50"
            >
              Follow-up
            </button>
            <button
              type="button"
              disabled={isBulkPending}
              onClick={() => handleBulkStatus('interested')}
              className="rounded bg-emerald-100 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
            >
              Interested
            </button>
            <button
              type="button"
              disabled={isBulkPending}
              onClick={() => handleBulkStatus('not_interested')}
              className="rounded bg-rose-100 px-2 py-1 font-medium text-rose-700 hover:bg-rose-200 disabled:opacity-50"
            >
              Not Interested
            </button>
            <button
              type="button"
              disabled={isBulkPending}
              onClick={() => handleBulkStatus('enquired')}
              className="rounded bg-purple-100 px-2 py-1 font-medium text-purple-700 hover:bg-purple-200 disabled:opacity-50"
            >
              Enquired
            </button>
            <button
              type="button"
              disabled={isBulkPending}
              onClick={() => handleBulkStatus('converted')}
              className="rounded bg-teal-100 px-2 py-1 font-medium text-teal-700 hover:bg-teal-200 disabled:opacity-50"
            >
              Converted
            </button>

            {isAdmin && (
              <button
                type="button"
                disabled={isBulkPending}
                onClick={() => setIsBulkDeleteOpen(true)}
                className="flex items-center gap-1 rounded bg-red-100 px-2.5 py-1 font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 ml-2 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete Selected</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-ink-500 hover:text-ink-800 ml-2"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-x-auto min-h-[340px] pb-32">
        <table className="w-full min-w-[850px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400 bg-ink-50/50">
              <th className="w-10 px-4 py-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center text-ink-400 hover:text-brand-600"
                  aria-label="Select all rows"
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4 text-brand-600" />
                  ) : someSelected ? (
                    <MinusSquare className="h-4 w-4 text-brand-600" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">Contact Name</th>
              <th className="px-4 py-3 font-semibold">Contact Number</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Package</th>
              <th className="px-4 py-3 text-center font-semibold">Days</th>
              <th className="px-4 py-3 font-semibold">Budget</th>
              <th className="px-4 py-3 font-semibold">From Date</th>
              <th className="px-4 py-3 font-semibold">To Date</th>
              <th className="px-4 py-3 text-center font-semibold">People</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              {isAdmin && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-ink-50">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 12 : 11} className="px-5 py-16 text-center text-ink-400">
                  No leads found matching your criteria.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const isChecked = selectedIds.has(lead.id);
                return (
                  <tr
                    key={lead.id}
                    className={`transition hover:bg-ink-50/50 ${isChecked ? 'bg-brand-50/30' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleRow(lead.id)}
                        className="flex items-center text-ink-400 hover:text-brand-600"
                        aria-label={`Select ${lead.contact_name}`}
                      >
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-brand-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink-900">{lead.contact_name}</td>
                    <td className="px-4 py-3 text-ink-600 font-mono text-xs">{lead.contact_number}</td>
                    <td className="px-4 py-3 text-ink-500 text-xs">{lead.email || '-'}</td>
                    <td className="px-4 py-3 text-ink-700">{lead.package || '-'}</td>
                    <td className="px-4 py-3 text-center text-ink-500">{lead.number_of_days ?? '-'}</td>
                    <td className="px-4 py-3 font-medium text-ink-700">
                      {lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-ink-500 text-xs">
                      {lead.from_date ? formatDate(lead.from_date) : '-'}
                    </td>
                    <td className="px-4 py-3 text-ink-500 text-xs">
                      {lead.to_date ? formatDate(lead.to_date) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-ink-500">{lead.number_of_people ?? '-'}</td>
                    <td className="px-4 py-3">
                      <LeadStatusSelect id={lead.id} status={lead.status} />
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <LeadRowActions lead={lead} isAdmin={isAdmin} />
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-100 px-4 py-3 text-xs text-ink-500 bg-ink-50/20">
          <div>
            Showing <span className="font-semibold text-ink-800">{startRow}</span> to{' '}
            <span className="font-semibold text-ink-800">{endRow}</span> of{' '}
            <span className="font-semibold text-ink-800">{totalCount.toLocaleString()}</span> leads
          </div>

          <div className="flex items-center gap-1.5">
            {/* First Page */}
            <Link
              href={buildPageHref(1)}
              className={`rounded p-1.5 transition ${
                currentPage <= 1
                  ? 'pointer-events-none text-ink-200'
                  : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
              }`}
              title="First Page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Link>

            {/* Prev Page */}
            <Link
              href={buildPageHref(Math.max(1, currentPage - 1))}
              className={`rounded p-1.5 transition ${
                currentPage <= 1
                  ? 'pointer-events-none text-ink-200'
                  : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
              }`}
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            {/* Page Numbers */}
            <div className="flex items-center gap-1 mx-1">
              {getPaginationPages().map((p, idx) => {
                if (typeof p === 'string') {
                  return (
                    <span key={`dots-${idx}`} className="px-1 text-ink-400">
                      ...
                    </span>
                  );
                }
                const isActive = p === currentPage;
                return (
                  <Link
                    key={p}
                    href={buildPageHref(p)}
                    className={`flex h-7 min-w-[28px] items-center justify-center rounded px-2 text-xs font-medium transition ${
                      isActive
                        ? 'bg-brand-600 text-white font-semibold shadow-sm'
                        : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                    }`}
                  >
                    {p}
                  </Link>
                );
              })}
            </div>

            {/* Next Page */}
            <Link
              href={buildPageHref(Math.min(totalPages, currentPage + 1))}
              className={`rounded p-1.5 transition ${
                currentPage >= totalPages
                  ? 'pointer-events-none text-ink-200'
                  : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
              }`}
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>

            {/* Last Page */}
            <Link
              href={buildPageHref(totalPages)}
              className={`rounded p-1.5 transition ${
                currentPage >= totalPages
                  ? 'pointer-events-none text-ink-200'
                  : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
              }`}
              title="Last Page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Popup Modal */}
      <DeleteConfirmModal
        isOpen={isBulkDeleteOpen}
        title={`Delete ${selectedIds.size} Lead${selectedIds.size !== 1 ? 's' : ''}`}
        description={`Are you sure you want to delete these ${selectedIds.size} selected leads? They will be moved to trash and soft-deleted.`}
        confirmLabel="Yes, Delete All"
        isPending={isBulkPending}
        onConfirm={executeBulkDelete}
        onClose={() => setIsBulkDeleteOpen(false)}
      />
    </div>
  );
}
