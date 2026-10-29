'use client';

import { useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { Plus, Search, Trash2, Pencil, Phone } from 'lucide-react';
import { deleteTransportVehicle } from '@/lib/tour/master-actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import { VehicleModal } from './vehicle-modal';
import type { TransportVehicleTableItem } from './actions';

interface TransportClientProps {
  vehicles: TransportVehicleTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  carTypes: string[];
  canEdit: boolean;
  canDelete: boolean;
  searchParams: { q?: string; vehicle_type?: string; page?: string };
}

export function TransportClient({
  vehicles,
  totalCount,
  totalPages,
  page,
  pageSize,
  carTypes,
  canEdit,
  canDelete,
  searchParams,
}: TransportClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);

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
      const res = await deleteTransportVehicle(deleteTarget.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Vehicle deleted successfully');
      setDeleteTarget(null);
      router.refresh();
    });
  }

  const handleOpenAdd = useCallback(() => {
    setSelectedVehicleId(null);
    setModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((id: number) => {
    setSelectedVehicleId(id);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedVehicleId(null);
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
                placeholder="Search car type, company, contact, phone…"
                className="input pl-9 w-full"
              />
            </div>
            <select
              name="vehicle_type"
              defaultValue={searchParams.vehicle_type ?? ''}
              className="input w-auto"
              aria-label="Filter by car type"
            >
              <option value="">All car types</option>
              {carTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
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
              <Plus className="h-4 w-4 mr-1.5" /> Add vehicle
            </button>
          )}
        </div>

        {/* Table Card */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3">Car type</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Free km</th>
                  <th className="px-5 py-3 text-right">Extra / km</th>
                  <th className="px-5 py-3 text-right">Bata / day</th>
                  <th className="px-5 py-3 text-center">Active</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-ink-400">
                      No vehicles found.{' '}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={handleOpenAdd}
                          className="text-brand-700 hover:underline font-medium"
                        >
                          Add the first vehicle
                        </button>
                      )}
                    </td>
                  </tr>
                )}
                {vehicles.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink-800">{v.vehicle_type}</p>
                      {v.seats_label && <p className="text-xs text-ink-400">{v.seats_label}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-ink-700">{v.company_name}</p>
                      {v.contact_person && <p className="text-xs text-ink-400">{v.contact_person}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <a
                        href={`tel:${v.contact_number}`}
                        className="inline-flex items-center gap-1 text-ink-700 hover:text-brand-700"
                      >
                        <Phone className="h-3 w-3 text-ink-400" />
                        {v.contact_number}
                      </a>
                      {v.alt_contact_number && (
                        <p className="text-xs text-ink-400">{v.alt_contact_number}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-800 font-medium">
                      {v.rate_label}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">
                      {v.free_label}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">
                      ₹{Math.round(v.extra_per_km).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">
                      ₹{Math.round(v.driver_bata_per_day).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`badge ${
                          v.is_active
                            ? 'bg-brand-100 text-brand-800'
                            : 'bg-ink-100 text-ink-500'
                        }`}
                      >
                        {v.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(v.id)}
                            className="btn-outline h-8 px-2.5 text-xs text-brand-700 hover:bg-brand-50"
                          >
                            <Pencil className="h-3 w-3 sm:mr-1 inline" />
                            <span>Edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: v.id, name: `${v.vehicle_type} (${v.company_name})` })}
                            disabled={deletePending}
                            className="btn-ghost h-8 px-2 text-xs text-coral-600 hover:bg-coral-50 hover:text-coral-700 disabled:opacity-50"
                            title="Delete vehicle"
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
      <VehicleModal
        isOpen={modalOpen}
        vehicleId={selectedVehicleId}
        onClose={handleCloseModal}
        onSuccess={() => router.refresh()}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={deleteTarget !== null}
        isPending={deletePending}
        title="Delete Vehicle"
        description={
          <>
            Are you sure you want to delete vehicle{' '}
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
