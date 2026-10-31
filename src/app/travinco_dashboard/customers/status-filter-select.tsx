'use client';

/** Status dropdown for the customers search form; the surrounding FilterBar applies it as soon as it changes. */
export function StatusFilterSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select
      name="status"
      defaultValue={defaultValue ?? ''}
      className="input w-full sm:w-44"
      aria-label="Filter by status"
    >
      <option value="">All statuses</option>
      <option value="active">Active</option>
      <option value="deactivated">Deactivated</option>
    </select>
  );
}
