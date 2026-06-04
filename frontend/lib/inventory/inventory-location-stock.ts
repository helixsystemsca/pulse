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

/** Normalize register-form lines before save (tool qty = 1; single line inherits form quantity). */
export function normalizeLocationLinesForSave(
  lines: { zone_id: string; quantity: number }[],
  itemType: string,
  formQuantity: number,
): { zone_id: string; quantity: number }[] {
  const withZone = lines.filter((l) => l.zone_id.trim());
  if (!withZone.length) return [];

  const normalized = withZone.map((l) => {
    let qty = l.quantity;
    if (itemType === "tool") return { zone_id: l.zone_id, quantity: 1 };
    if (qty <= 0 && withZone.length === 1 && formQuantity > 0) qty = formQuantity;
    return { zone_id: l.zone_id, quantity: qty };
  });

  return normalized.filter((l) => l.quantity > 0);
}

function formatOneLocationLine(
  name: string,
  quantity: number | null,
  *,
  showQuantity: boolean,
): string {
  if (!showQuantity || quantity == null) return name;
  return `${name} (${quantity})`;
}

/** One display line per storage location (for stacked list UI). */
export function getItemLocationDisplayLines(
  row: {
    location_name?: string | null;
    zone_id?: string | null;
    custom_attributes?: Record<string, string | number | boolean | null> | undefined;
  },
  zoneName: (zoneId: string) => string | null | undefined,
): string[] {
  const stock = parseLocationStock(row.custom_attributes);
  if (stock.length > 0) {
    const showQty = stock.length > 1;
    return stock.map((l) => {
      const name = zoneName(l.zone_id) ?? "Location";
      return formatOneLocationLine(name, l.quantity, showQuantity: showQty);
    });
  }
  const fromApi = row.location_name?.trim();
  if (fromApi) {
    if (fromApi.includes(", ")) {
      return fromApi
        .split(", ")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [fromApi];
  }
  if (row.zone_id) {
    const name = zoneName(row.zone_id);
    return [name?.trim() || "—"];
  }
  return ["—"];
}

export function formatLocationStockLabel(
  lines: LocationStockLine[],
  zoneName: (zoneId: string) => string | null | undefined,
): string {
  if (!lines.length) return "";
  const showQty = lines.length > 1;
  return lines
    .map((l) => {
      const name = zoneName(l.zone_id) ?? "Location";
      return formatOneLocationLine(name, l.quantity, showQuantity: showQty);
    })
    .join(", ");
}

/** Display label for list/detail/table — prefers API `location_name`, then stock breakdown, then zone id. */
export function resolveItemLocationDisplay(
  row: {
    location_name?: string | null;
    zone_id?: string | null;
    custom_attributes?: Record<string, string | number | boolean | null> | undefined;
  },
  zoneName: (zoneId: string) => string | null | undefined,
): string {
  const lines = getItemLocationDisplayLines(row, zoneName);
  if (lines.length === 1 && lines[0] === "—") return "—";
  return lines.join(", ");
}
