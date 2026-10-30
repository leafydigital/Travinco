'use client';

/** Status dropdown for the customers search form; applies the filter as soon as it changes. */
export function StatusFilterSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select
      name="status"
      defaultValue={defaultValue ?? ''}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="input w-full sm:w-44"
      aria-label="Filter by status"
    >
      <option value="">All statuses</option>
      <option value="active">Active</option>
      <option value="deactivated">Deactivated</option>
      <option value="deleted">Deleted</option>
    </select>
  );
}
