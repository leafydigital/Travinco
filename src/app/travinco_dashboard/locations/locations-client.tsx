'use client';

import { useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { Plus, Search, Trash2, Pencil, MapPin } from 'lucide-react';
import { deleteLocation } from '@/lib/tour/master-actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import { BulkCreateLocationsButton } from './bulk-create-modal';
import { LocationModal } from './location-modal';
import type { LocationTableItem, ParentLocationOption } from './actions';

interface LocationsClientProps {
  locations: LocationTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  states: string[];
  parentLocations: ParentLocationOption[];
  canEdit: boolean;
  canDelete: boolean;
  searchParams: { q?: string; state?: string; page?: string };
}

export function LocationsClient({
  locations,
  totalCount,
  totalPages,
  page,
  pageSize,
  states,
  parentLocations,
  canEdit,
  canDelete,
  searchParams,
}: LocationsClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

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
      const res = await deleteLocation(deleteTarget.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Location deleted successfully');
      setDeleteTarget(null);
      router.refresh();
    });
  }

  const handleOpenAdd = useCallback(() => {
    setSelectedLocationId(null);
    setModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((id: number) => {
    setSelectedLocationId(id);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedLocationId(null);
  }, []);

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
                placeholder="Search location, display name, state…"
                className="input pl-9 w-full"
              />
            </div>
            <select
              name="state"
              defaultValue={searchParams.state ?? ''}
              className="input w-auto"
              aria-label="Filter by state"
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-outline">
              Filter
            </button>
          </form>

          <div className="flex items-center gap-2">
            {canEdit && (
              <BulkCreateLocationsButton
                parentLocations={parentLocations}
                states={states}
              />
            )}
            {canEdit && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-1.5" /> Add location
              </button>
            )}
          </div>
        </div>

        {/* Table Card */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">State</th>
                  <th className="px-5 py-3">Part of</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-right">Hotels</th>
                  <th className="px-5 py-3 text-right">Activities</th>
                  <th className="px-5 py-3 text-center">Active</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-ink-400">
                      No locations found.{' '}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={handleOpenAdd}
                          className="text-brand-600 hover:underline font-medium"
                        >
                          Add the first location
                        </button>
                      )}
                    </td>
                  </tr>
                )}
                {locations.map((l) => (
                  <tr key={l.id} className="border-b border-ink-50 hover:bg-ink-50/50 transition-colors">
                    {/* Location Name & Display Name */}
                    <td className="px-5 py-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-ink-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-ink-900">{l.name}</p>
                          {l.display_name && l.display_name !== l.name && (
                            <p className="text-xs text-ink-400">{l.display_name}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* State */}
                    <td className="px-5 py-3 text-ink-700">{l.state}</td>

                    {/* Part of */}
                    <td className="px-5 py-3 text-ink-700">
                      {l.parent_name ? (
                        <span className="font-medium text-ink-800">{l.parent_name}</span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-5 py-3">
                      <span
                        className={`badge text-xs font-medium px-2.5 py-0.5 rounded-full ${
                          l.is_houseboat
                            ? 'bg-ocean-100 text-ocean-800'
                            : 'bg-sand-100 text-sand-800'
                        }`}
                      >
                        {l.type}
                      </span>
                    </td>

                    {/* Hotels Count */}
                    <td className="px-5 py-3 text-right tabular-nums text-ink-700 font-medium">
                      {l.hotels_count}
                    </td>

                    {/* Activities Count */}
                    <td className="px-5 py-3 text-right tabular-nums text-ink-700 font-medium">
                      {l.activities_count}
                    </td>

                    {/* Active */}
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`badge ${
                          l.is_active
                            ? 'bg-brand-100 text-brand-800'
                            : 'bg-ink-100 text-ink-500'
                        }`}
                      >
                        {l.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(l.id)}
                            className="btn-outline h-8 px-2.5 text-xs text-brand-700 hover:bg-brand-50"
                          >
                            <Pencil className="h-3 w-3 sm:mr-1 inline" />
                            <span>Edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: l.id, name: l.name })}
                            disabled={deletePending}
                            className="btn-ghost h-8 px-2 text-xs text-coral-600 hover:bg-coral-50 hover:text-coral-700 disabled:opacity-50"
                            title="Delete location"
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
      <LocationModal
        isOpen={modalOpen}
        locationId={selectedLocationId}
        parentLocations={parentLocations}
        states={states}
        onClose={handleCloseModal}
        onSuccess={() => router.refresh()}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={deleteTarget !== null}
        isPending={deletePending}
        title="Delete Location"
        description={
          <>
            Are you sure you want to delete location{' '}
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
