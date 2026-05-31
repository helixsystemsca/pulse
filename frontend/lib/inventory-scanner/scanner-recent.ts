const STORAGE_KEY = "pulse.inventory-scanner.recent.v1";
const MAX_RECENT = 8;

export type ScannerRecentItem = {
  id: string;
  sku: string;
  name: string;
};

export function readScannerRecentItems(): ScannerRecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is ScannerRecentItem =>
          Boolean(row) &&
          typeof row === "object" &&
          typeof (row as ScannerRecentItem).id === "string" &&
          typeof (row as ScannerRecentItem).sku === "string" &&
          typeof (row as ScannerRecentItem).name === "string",
      )
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function rememberScannerRecentItem(item: ScannerRecentItem): ScannerRecentItem[] {
  const next = [item, ...readScannerRecentItems().filter((r) => r.id !== item.id)].slice(0, MAX_RECENT);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
