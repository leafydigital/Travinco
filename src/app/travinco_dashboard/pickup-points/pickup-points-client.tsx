'use client';

import { useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Pencil, MapPin } from 'lucide-react';
import { deletePickupPoint } from '@/lib/tour/master-actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import { PointModal } from './point-modal';
import type { PickupPointTableItem, LocationOption } from './actions';

interface PickupPointsClientProps {
  points: PickupPointTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  locations: LocationOption[];
  canEdit: boolean;
  canDelete: boolean;
  searchParams: { q?: string; point_type?: string; location_id?: string; page?: string };
}

const POINT_TYPES = [
  { value: 'airport', label: 'Airport' },
  { value: 'railway', label: 'Railway station' },
  { value: 'bus', label: 'Bus stand' },
  { value: 'hotel', label: 'Hotel / residence' },
  { value: 'port', label: 'Port / jetty' },
  { value: 'other', label: 'Other' },
];

export function PickupPointsClient({
  points,
  totalCount,
  totalPages,
  page,
  pageSize,
  locations,
  canEdit,
  canDelete,
  searchParams,
}: PickupPointsClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null);

  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ ...searchParams, ...o }).forEach(([k, v]) => v && p.set(k, v));
    return `?${p.toString()}`;
  };

  function handleDelete() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const res = await deletePickupPoint(deleteTarget.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Pickup point deleted successfully');
      setDeleteTarget(null);
      router.refresh();
    });
  }

  const handleOpenAdd = useCallback(() => {
    setSelectedPointId(null);
    setModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((id: number) => {
    setSelectedPointId(id);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedPointId(null);
  }, []);

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'airport':
        return 'bg-ocean-100 text-ocean-800';
      case 'railway':
        return 'bg-amber-100 text-amber-800';
      case 'bus':
        return 'bg-purple-100 text-purple-800';
      case 'hotel':
        return 'bg-emerald-100 text-emerald-800';
      case 'port':
        return 'bg-teal-100 text-teal-800';
      default:
        return 'bg-ink-100 text-ink-700';
    }
  };

  return (
    <>
      <div className="space-y-5">
        {/* Top Header Actions & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form method="get" className="flex flex-wrap items-center gap-3 flex-1 max-w-2xl">
            <div className="relative min-w-[220px] max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                name="q"
                defaultValue={searchParams.q ?? ''}
                placeholder="Search point, code, address…"
                className="input pl-9 w-full"
              />
            </div>
            <select
              name="point_type"
              defaultValue={searchParams.point_type ?? ''}
              className="input w-auto"
              aria-label="Filter by point type"
            >
              <option value="">All point types</option>
              {POINT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-outline">
              Filter
            </button>
          </form>

          {canEdit && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="btn-primary"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add point
            </button>
          )}
        </div>

        {/* Table Card */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3">Point</th>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Town</th>
                  <th className="px-5 py-3 text-right">To town</th>
                  <th className="px-5 py-3">Used for</th>
                  <th className="px-5 py-3 text-center">Active</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {points.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-ink-400">
                      No pickup or drop points found.{' '}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={handleOpenAdd}
                          className="text-brand-600 hover:underline font-medium"
                        >
                          Add the first point
                        </button>
                      )}
                    </td>
                  </tr>
                )}
                {points.map((p) => (
                  <tr key={p.id} className="border-b border-ink-50 hover:bg-ink-50/50 transition-colors">
                    {/* Point Name & Subtitle */}
                    <td className="px-5 py-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-ink-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-ink-900">{p.name}</p>
                          {p.address && (
                            <p className="text-xs text-ink-400 truncate max-w-xs">{p.address}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Code */}
                    <td className="px-5 py-3 text-ink-700 font-mono text-xs">
                      {p.code ? (
                        <span className="font-semibold px-2 py-0.5 rounded bg-ink-100 text-ink-800">
                          {p.code}
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-5 py-3">
                      <span className={`badge text-xs font-medium px-2 py-0.5 rounded-full ${getTypeBadgeClass(p.point_type)}`}>
                        {p.type_label}
                      </span>
                    </td>

                    {/* Town */}
                    <td className="px-5 py-3 text-ink-800">
                      {p.town_label}
                    </td>

                    {/* To town */}
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">
                      {p.km_label}
                    </td>

                    {/* Used for */}
                    <td className="px-5 py-3 text-ink-700">
                      <span className="font-medium">{p.used_for}</span>
                    </td>

                    {/* Active */}
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`badge ${
                          p.is_active
                            ? 'bg-brand-100 text-brand-800'
                            : 'bg-ink-100 text-ink-500'
                        }`}
                      >
                        {p.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p.id)}
                            className="btn-outline h-8 px-2.5 text-xs text-brand-700 hover:bg-brand-50"
                          >
                            <Pencil className="h-3 w-3 sm:mr-1 inline" />
                            <span>Edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                            disabled={deletePending}
                            className="btn-ghost h-8 px-2 text-xs text-coral-600 hover:bg-coral-50 hover:text-coral-700 disabled:opacity-50"
                            title="Delete pickup point"
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:mr-1 inline" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm text-ink-500">
              <span>
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={href({ page: String(page - 1) })}
                    className="btn-outline px-3 py-1.5"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={href({ page: String(page + 1) })}
                    className="btn-outline px-3 py-1.5"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <PointModal
        isOpen={modalOpen}
        pointId={selectedPointId}
        locations={locations}
        onClose={handleCloseModal}
        onSuccess={() => router.refresh()}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={deleteTarget !== null}
        isPending={deletePending}
        title="Delete Pickup / Drop Point"
        description={
          <>
            Are you sure you want to delete pickup point{' '}
            <strong className="text-ink-900">{deleteTarget?.name}</strong>? This action
            cannot be undone.
          </>
        }
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
