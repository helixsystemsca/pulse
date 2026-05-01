/** Persist zone extras in `BlueprintElement.symbol_notes` (JSON after prefix). */

export const ZONE_META_PREFIX = "pulse-zone:v1:";

export type ZoneOverlayMeta = { zone_type: string; notes: string };

export function packZoneMeta(meta: Partial<ZoneOverlayMeta>): string | undefined {
  const zone_type = (meta.zone_type ?? "").trim();
  const notes = (meta.notes ?? "").trim();
  if (!zone_type && !notes) return undefined;
  return `${ZONE_META_PREFIX}${JSON.stringify({ zone_type, notes })}`;
}

export function parseZoneMeta(symbol_notes?: string | null): ZoneOverlayMeta {
  if (!symbol_notes?.startsWith(ZONE_META_PREFIX)) {
    return { zone_type: "", notes: "" };
  }
  try {
    const j = JSON.parse(symbol_notes.slice(ZONE_META_PREFIX.length)) as Record<string, unknown>;
    return {
      zone_type: typeof j.zone_type === "string" ? j.zone_type : "",
      notes: typeof j.notes === "string" ? j.notes : "",
    };
  } catch {
    return { zone_type: "", notes: "" };
  }
}
