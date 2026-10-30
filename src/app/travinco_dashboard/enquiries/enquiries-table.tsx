'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckSquare, ListChecks, Loader2, MinusSquare, Square, Trash2, UserCheck, UserX } from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { formatDate } from '@/lib/utils/format';
import { enquirySourceLabel } from '@/lib/enquiry-display';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeleteConfirmModal } from '@/components/admin/delete-confirm-modal';
import { EnquiryRowActions } from './enquiry-row-actions';
import { EnquiryStatusSelector } from './enquiry-status-selector';
import { FollowupDateCell } from './followup-date-cell';
import { EnquiryPagination } from './enquiry-pagination';
import { bulkAssignEnquiries, bulkDeleteEnquiries, bulkUpdateEnquiryStatus, type EnquiryTableItem } from './actions';
import { ENQUIRY_STATUS_OPTIONS } from '@/lib/enquiry-status';
import type { EnquiryStatus } from '@/types/database';

interface Props {
  enquiries: EnquiryTableItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  isAdmin: boolean;
  canEdit: boolean;
  staff: { id: string; full_name: string }[];
  today: string;
}

export function EnquiriesTable({ enquiries, totalCount, currentPage, pageSize, isAdmin, canEdit, staff, today }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState('');
  const [newStatus, setNewStatus] = useState<EnquiryStatus | ''>('');
  // Admins select rows to assign/delete/change status; employees to change status
  const canSelect = isAdmin || canEdit;
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // A new page / filter result starts with nothing selected
  const rowsKey = useMemo(() => enquiries.map((e) => e.id).join(','), [enquiries]);
  useEffect(() => setSelectedIds(new Set()), [rowsKey]);

  const allSelected = enquiries.length > 0 && enquiries.every((e) => selectedIds.has(e.id));
  const someSelected = !allSelected && enquiries.some((e) => selectedIds.has(e.id));
  const columnCount = canSelect ? 10 : 9;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(enquiries.map((e) => e.id)));
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runAssign(staffId: string | null) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (staffId === '') {
      toast.error('Choose an employee to assign to.');
      return;
    }
    startTransition(async () => {
      const res = await bulkAssignEnquiries(ids, staffId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const name = staffId ? staff.find((s) => s.id === staffId)?.full_name ?? 'employee' : null;
      toast.success(
        name
          ? `${res.count} enquir${res.count === 1 ? 'y' : 'ies'} assigned to ${name}`
          : `${res.count} enquir${res.count === 1 ? 'y' : 'ies'} unassigned`
      );
      setSelectedIds(new Set());
      setAssignTo('');
      router.refresh();
    });
  }

  function runStatusChange() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !newStatus) return;
    startTransition(async () => {
      const res = await bulkUpdateEnquiryStatus(ids, newStatus);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const label = ENQUIRY_STATUS_OPTIONS.find((o) => o.value === newStatus)?.label ?? newStatus;
      toast.success(
        res.count
          ? `${res.count} enquir${res.count === 1 ? 'y' : 'ies'} moved to ${label}`
          : `The selected enquiries are already ${label}`
      );
      setSelectedIds(new Set());
      setNewStatus('');
      router.refresh();
    });
  }

  function runDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkDeleteEnquiries(ids);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted ${res.count} enquir${res.count === 1 ? 'y' : 'ies'}`);
      setSelectedIds(new Set());
      setIsDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {canSelect && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200 bg-brand-50/70 px-5 py-2.5 text-xs text-brand-900">
          <p>
            <span className="font-semibold">{selectedIds.size}</span> enquir{selectedIds.size === 1 ? 'y' : 'ies'} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as EnquiryStatus | '')}
              disabled={isPending}
              className="input h-8 w-52 py-0 text-xs"
              aria-label="New status"
            >
              <option value="">Change status to…</option>
              {ENQUIRY_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={runStatusChange}
              disabled={isPending || !newStatus}
              className="btn-primary inline-flex h-8 items-center gap-1.5 px-3 text-xs disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListChecks className="h-3.5 w-3.5" />}
              Update status
            </button>

            {isAdmin && (
              <>
                <span className="mx-1 h-5 w-px bg-brand-200" aria-hidden />
            <select
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              disabled={isPending}
              className="input h-8 w-48 py-0 text-xs"
              aria-label="Employee to assign"
            >
              <option value="">Assign to employee…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => runAssign(assignTo)}
              disabled={isPending || !assignTo}
              className="btn-primary inline-flex h-8 items-center gap-1.5 px-3 text-xs disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
              Assign
            </button>
            <button
              type="button"
              onClick={() => runAssign(null)}
              disabled={isPending}
              className="btn-outline inline-flex h-8 items-center gap-1.5 px-3 text-xs disabled:opacity-50"
            >
              <UserX className="h-3.5 w-3.5" /> Unassign
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteOpen(true)}
              disabled={isPending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-100 px-3 font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-1 text-ink-500 hover:text-ink-800"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              {canSelect && (
                <th className="w-10 py-3 pl-5 pr-1">
                  <button
                    type="button"
                    onClick={toggleAll}
                    disabled={enquiries.length === 0}
                    className="flex items-center text-ink-400 hover:text-brand-600"
                    aria-label="Select all enquiries on this page"
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
              )}
              <th className="px-5 py-3">Enquiry #</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Destination / Travel</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Priority</th>
              <th className="px-5 py-3">Follow-up</th>
              <th className="px-5 py-3">Assigned</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-5 py-12 text-center text-ink-400">
                  <AlertCircle className="mx-auto mb-2 h-7 w-7 text-ink-300" />
                  <p className="font-medium text-ink-700">No enquiries found</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {isAdmin ? 'Try resetting filters or search query' : 'Enquiries assigned to you will show here'}
                  </p>
                </td>
              </tr>
            )}
            {enquiries.map((e) => {
              const isTodayTravel = e.travel_date === today;
              const isChecked = selectedIds.has(e.id);
              const source = enquirySourceLabel(e.source);
              return (
                <tr
                  key={e.id}
                  className={`border-b border-ink-50 last:border-0 hover:bg-ink-50/50 ${isChecked ? 'bg-brand-50/30' : ''}`}
                >
                  {canSelect && (
                    <td className="py-3 pl-5 pr-1">
                      <button
                        type="button"
                        onClick={() => toggleRow(e.id)}
                        className="flex items-center text-ink-400 hover:text-brand-600"
                        aria-label={`Select ${e.enquiry_number}`}
                      >
                        {isChecked ? <CheckSquare className="h-4 w-4 text-brand-600" /> : <Square className="h-4 w-4" />}
                      </button>
                    </td>
                  )}

                  <td className="px-5 py-3">
                    <Link
                      href={`/travinco_dashboard/enquiries/${e.id}`}
                      prefetch={true}
                      className="font-medium text-ink-800 hover:text-brand-700 hover:underline"
                    >
                      {e.enquiry_number}
                    </Link>
                    <p className="text-[11px] text-ink-400" title={e.enquiry_received_from ?? undefined}>
                      {e.enquiry_received_from ? `${source} · ${e.enquiry_received_from}` : source}
                    </p>
                  </td>

                  <td className="px-5 py-3">
                    <p className="font-medium text-ink-800">{e.customer_name}</p>
                    <p className="text-xs text-ink-400">{e.phone}</p>
                  </td>

                  <td className="px-5 py-3">
                    <p className="text-ink-700">{e.destination || '—'}</p>
                    {e.travel_date && (
                      <p className={`text-xs ${isTodayTravel ? 'font-semibold text-rose-600' : 'text-ink-400'}`}>
                        {formatDate(e.travel_date)}
                        {isTodayTravel && ' (Today)'}
                      </p>
                    )}
                  </td>

                  <td className="px-5 py-3">
                    <EnquiryStatusSelector enquiryId={e.id} currentStatus={e.status} canEdit={canEdit} />
                  </td>

                  <td className="px-5 py-3">
                    <StatusBadge status={e.priority} />
                  </td>

                  <td className="px-5 py-3">
                    <FollowupDateCell
                      enquiryId={e.id}
                      customerName={e.customer_name}
                      enquiryNumber={e.enquiry_number}
                      currentDate={e.next_followup_date}
                      status={e.status}
                    />
                  </td>

                  <td className={`px-5 py-3 ${e.assigned_staff ? 'text-ink-600' : 'text-ink-400 italic'}`}>
                    {e.assigned_staff_name}
                  </td>

                  <td className="whitespace-nowrap px-5 py-3 text-ink-500">{formatDate(e.enquiry_date)}</td>

                  <td className="px-5 py-3 text-right">
                    <EnquiryRowActions id={e.id} customerName={e.customer_name} isAdmin={isAdmin} canEdit={canEdit} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <EnquiryPagination totalCount={totalCount} currentPage={currentPage} pageSize={pageSize} />

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        title={`Delete ${selectedIds.size} enquir${selectedIds.size === 1 ? 'y' : 'ies'}`}
        description="The selected enquiries will be removed from the list. This cannot be undone from the dashboard."
        confirmLabel="Yes, delete"
        isPending={isPending}
        onConfirm={runDelete}
        onClose={() => setIsDeleteOpen(false)}
      />
    </>
  );
}
