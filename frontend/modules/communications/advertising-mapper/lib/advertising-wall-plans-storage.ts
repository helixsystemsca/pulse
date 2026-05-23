import { readSession } from "@/lib/pulse-session";
import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";

const STORAGE_VERSION = "v1";

function storageKey(): string {
  const cid = readSession()?.company_id?.trim() || "default";
  return `pulse.advertising.wall-plans.${STORAGE_VERSION}:${cid}`;
}

/** Omit backdrop blobs — those live in `advertising-wall-backdrop-storage`. */
function stripBackdrop(w: FacilityWallPlan): FacilityWallPlan {
  const { backdropUrl: _u, backdropNaturalWidth: _w, backdropNaturalHeight: _h, ...rest } = w;
  return rest;
}

export function loadPersistedAdvertisingWalls(): FacilityWallPlan[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as FacilityWallPlan[];
  } catch {
    return null;
  }
}

export function savePersistedAdvertisingWalls(walls: readonly FacilityWallPlan[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload = walls.map(stripBackdrop);
    localStorage.setItem(storageKey(), JSON.stringify(payload));
  } catch {
    /* quota — non-fatal */
  }
}
