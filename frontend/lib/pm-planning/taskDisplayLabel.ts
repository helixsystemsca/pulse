/**
 * PM planning UI was built against demo tasks (`T01`…`T20`). Real projects use UUID task ids;
 * these helpers keep chips and badges readable without leaking full ids into tiny boxes.
 */

/** Pool-shutdown style ids from mock data. */
export function isDemoStylePmTaskId(id: string): boolean {
  return /^T\d+$/i.test(id.trim());
}

/** Human-readable Gantt / resource bar label; never shows full UUID when a name exists. */
export function pmTaskBarLabel(name: string | undefined | null, id: string): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) return trimmed;
  return formatPmTaskChipId(id);
}

/** Compact label for network nodes, resource bars, and similar. */
export function formatPmTaskChipId(id: string): string {
  const s = id.trim();
  if (isDemoStylePmTaskId(s)) return s.replace(/^T/i, "");
  const hex = s.replace(/-/g, "");
  if (hex.length >= 8 && /^[a-f0-9]+$/i.test(hex)) return hex.slice(0, 4).toUpperCase();
  return s.slice(0, 4).toUpperCase();
}
