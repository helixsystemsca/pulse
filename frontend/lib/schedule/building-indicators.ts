import type { Zone } from "@/lib/schedule/types";

export type BuildingIndicator = {
  code: string; // e.g. "PAN", "GG"
  label?: string; // e.g. "Panorama"
};

function abbrevFromLabel(name: string): string {
  const parts = name
    .trim()
    .split(/[\s\-_/]+/g)
    .filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, 3).map((p) => p[0]!.toUpperCase()).join("");
  const s = parts[0] ?? "";
  return s.slice(0, 3).toUpperCase();
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

/**
 * Pull a building code from Zone meta if present.
 *
 * Supported shapes (to avoid hardcoding PAN/GG):
 * - meta.building_code = "PAN"
 * - meta.building_name = "Panorama"
 * - meta.building = { code: "PAN", name: "Panorama" }
 */
export function buildingIndicatorForZone(zone: Zone | undefined | null): BuildingIndicator | null {
  if (!zone?.meta || typeof zone.meta !== "object") return null;
  const meta = zone.meta as Record<string, unknown>;

  const buildingCode = readString(meta, "building_code");
  const buildingName = readString(meta, "building_name");

  const buildingObj = meta.building && typeof meta.building === "object" ? (meta.building as Record<string, unknown>) : null;
  const codeFromObj = buildingObj ? readString(buildingObj, "code") : null;
  const nameFromObj = buildingObj ? readString(buildingObj, "name") : null;

  const code = (buildingCode || codeFromObj || (buildingName || nameFromObj ? abbrevFromLabel(buildingName || nameFromObj || "") : "")).trim();
  if (!code) return null;
  return { code, label: buildingName || nameFromObj || undefined };
}

