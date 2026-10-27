'use client';

import { useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Pencil, Navigation } from 'lucide-react';
import { deleteDistance } from '@/lib/tour/master-actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import { BulkCreateDistancesButton } from './bulk-create-modal';
import { DistanceModal } from './distance-modal';
import type { DistanceTableItem } from './actions';

interface DistancesClientProps {
  distances: DistanceTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  locations: Array<{ id: number; name: string; display_name?: string | null }>;
  canEdit: boolean;
  canDelete: boolean;
  searchParams: { q?: string; location_id?: string; page?: string };
}

export function DistancesClient({
  distances,
  totalCount,
  totalPages,
  page,
  pageSize,
  locations,
  canEdit,
  canDelete,
  searchParams,
}: DistancesClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDistanceId, setSelectedDistanceId] = useState<number | null>(null);

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
      const res = await deleteDistance(deleteTarget.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Distance entry deleted successfully');
      setDeleteTarget(null);
      router.refresh();
    });
  }

  const handleOpenAdd = useCallback(() => {
    setSelectedDistanceId(null);
    setModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((id: number) => {
    setSelectedDistanceId(id);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedDistanceId(null);
  }, []);

  return (
    <>
      <div className="space-y-5">
        <p className="text-sm text-ink-500">
          One entry per pair works both ways. Quotations add these up (plus pickup/drop distances and local sightseeing running) to estimate vehicle kilometres.
        </p>

        {/* Top Header Actions & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form method="get" className="flex flex-wrap items-center gap-3 flex-1 max-w-2xl">
            <div className="relative min-w-[220px] max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                name="q"
                defaultValue={searchParams.q ?? ''}
                placeholder="Search route or drive time…"
                className="input pl-9 w-full"
              />
            </div>
            <select
              name="location_id"
              defaultValue={searchParams.location_id ?? ''}
              className="input w-auto"
              aria-label="Filter by location"
            >
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={String(l.id)}>
                  {l.display_name || l.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-outline">
              Filter
            </button>
          </form>

          <div className="flex items-center gap-2">
            {canEdit && (
              <BulkCreateDistancesButton locations={locations} />
            )}
            {canEdit && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-1.5" /> Add distance
              </button>
            )}
          </div>
        </div>

        {/* Table Card */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3">Route</th>
                  <th className="px-5 py-3 text-right">Distance</th>
                  <th className="px-5 py-3">Drive time</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {distances.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-ink-400">
                      No distance routes found.{' '}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={handleOpenAdd}
                          className="text-brand-600 hover:underline font-medium"
                        >
                          Add the first route
                        </button>
                      )}
                    </td>
                  </tr>
                )}
                {distances.map((d) => (
                  <tr key={d.id} className="border-b border-ink-50 hover:bg-ink-50/50 transition-colors">
                    {/* Route */}
                    <td className="px-5 py-3">
                      <div className="flex items-start gap-2">
                        <Navigation className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-ink-900">{d.route}</p>
                          {d.notes && (
                            <p className="text-xs text-ink-400 truncate max-w-sm">{d.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Distance (km) */}
                    <td className="px-5 py-3 text-right tabular-nums text-ink-800 font-semibold">
                      {d.distance_label}
                    </td>

                    {/* Drive time */}
                    <td className="px-5 py-3 text-ink-700">
                      {d.duration_text ? (
                        <span className="font-medium">{d.duration_text}</span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(d.id)}
                            className="btn-outline h-8 px-2.5 text-xs text-brand-700 hover:bg-brand-50"
                          >
                            <Pencil className="h-3 w-3 sm:mr-1 inline" />
                            <span>Edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: d.id, name: d.route })}
                            disabled={deletePending}
                            className="btn-ghost h-8 px-2 text-xs text-coral-600 hover:bg-coral-50 hover:text-coral-700 disabled:opacity-50"
                            title="Delete distance entry"
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
      <DistanceModal
        isOpen={modalOpen}
        distanceId={selectedDistanceId}
        locations={locations}
        onClose={handleCloseModal}
        onSuccess={() => router.refresh()}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={deleteTarget !== null}
        isPending={deletePending}
        title="Delete Distance Entry"
        description={
          <>
            Are you sure you want to delete route{' '}
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
