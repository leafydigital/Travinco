type LabelledLocation = { id: number; name: string; display_name?: string | null };

/** Label shown for a location in pickers. */
export const locationLabel = (l: LabelledLocation) => l.display_name || l.name;

/** Matches typed text to a location by its label or rate-master name (case-insensitive). */
export function findLocationByLabel<T extends LabelledLocation>(list: T[], text: string): T | undefined {
  const q = text.trim().toLowerCase();
  if (!q) return undefined;
  return list.find((l) => locationLabel(l).toLowerCase() === q) ?? list.find((l) => l.name.toLowerCase() === q);
}
