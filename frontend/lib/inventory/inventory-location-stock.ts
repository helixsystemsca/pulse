/** Per-zone stock breakdown stored on inventory items (`custom_attributes.location_stock`). */

export const LOCATION_STOCK_KEY = "location_stock";

export type LocationStockLine = {
  zone_id: string;
  quantity: number;
};

export function parseLocationStock(
  attrs: Record<string, string | number | boolean | null> | undefined,
): LocationStockLine[] {
  if (!attrs) return [];
  const raw = attrs[LOCATION_STOCK_KEY];
  if (!Array.isArray(raw)) return [];
  const out: LocationStockLine[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const zone_id = String((entry as { zone_id?: unknown }).zone_id ?? "").trim();
    const q = Number((entry as { quantity?: unknown }).quantity);
    if (!zone_id || Number.isNaN(q) || q <= 0) continue;
    out.push({ zone_id, quantity: q });
  }
  return out;
}

export function locationStockToCustomAttributes(
  lines: LocationStockLine[],
): Record<string, LocationStockLine[]> {
  if (!lines.length) return {};
  return { [LOCATION_STOCK_KEY]: lines };
}

export function sumLocationStockQuantity(lines: LocationStockLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function formatLocationStockLabel(
  lines: LocationStockLine[],
  zoneName: (zoneId: string) => string | null | undefined,
): string {
  if (!lines.length) return "";
  if (lines.length === 1) return zoneName(lines[0].zone_id) ?? "—";
  return lines
    .map((l) => {
      const name = zoneName(l.zone_id) ?? "Location";
      return `${name} (${l.quantity})`;
    })
    .join(", ");
}
