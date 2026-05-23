import { readSession } from "@/lib/pulse-session";
import type { WallBackdropPatch } from "@/modules/communications/advertising-mapper/lib/advertising-backdrop-image";

const STORAGE_VERSION = "v1";

export type StoredWallBackdrop = WallBackdropPatch;

type FacilityWallPlanLike = {
  id: string;
  backdropUrl?: string;
  backdropNaturalWidth?: number;
  backdropNaturalHeight?: number;
};

function storageKey(): string {
  const cid = readSession()?.company_id?.trim() || "default";
  return `pulse.advertising.wall-backdrops.${STORAGE_VERSION}:${cid}`;
}

export function loadAllWallBackdrops(): Record<string, StoredWallBackdrop> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, StoredWallBackdrop> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const o = value as Record<string, unknown>;
      const url = typeof o.backdropUrl === "string" ? o.backdropUrl : "";
      const w = typeof o.backdropNaturalWidth === "number" ? o.backdropNaturalWidth : 0;
      const h = typeof o.backdropNaturalHeight === "number" ? o.backdropNaturalHeight : 0;
      if (url && w > 0 && h > 0) out[id] = { backdropUrl: url, backdropNaturalWidth: w, backdropNaturalHeight: h };
    }
    return out;
  } catch {
    return {};
  }
}

export function saveWallBackdrop(wallId: string, backdrop: StoredWallBackdrop | null): void {
  if (typeof window === "undefined") return;
  const all = loadAllWallBackdrops();
  if (backdrop) all[wallId] = backdrop;
  else delete all[wallId];
  try {
    localStorage.setItem(storageKey(), JSON.stringify(all));
  } catch {
    throw new Error("Photo is too large to save in this browser. Try a smaller image.");
  }
}

/** Persist one wall backdrop (no-op when no image is loaded). */
export function persistWallBackdropForPlan(
  wall: Pick<FacilityWallPlanLike, "id" | "backdropUrl" | "backdropNaturalWidth" | "backdropNaturalHeight">,
): void {
  if (wall.backdropUrl && wall.backdropNaturalWidth && wall.backdropNaturalHeight) {
    saveWallBackdrop(wall.id, {
      backdropUrl: wall.backdropUrl,
      backdropNaturalWidth: wall.backdropNaturalWidth,
      backdropNaturalHeight: wall.backdropNaturalHeight,
    });
  } else {
    saveWallBackdrop(wall.id, null);
  }
}

/** Save background photos for every wall view (browser local storage, per facility). */
export function persistAllWallBackdrops(
  walls: readonly FacilityWallPlanLike[],
): { savedCount: number } {
  let savedCount = 0;
  for (const w of walls) {
    if (w.backdropUrl && w.backdropNaturalWidth && w.backdropNaturalHeight) {
      persistWallBackdropForPlan(w);
      savedCount++;
    } else {
      saveWallBackdrop(w.id, null);
    }
  }
  return { savedCount };
}

export function mergeWallPlanBackdrops<T extends { id: string }>(
  walls: readonly T[],
  backdrops: Record<string, StoredWallBackdrop>,
): Array<T & Partial<StoredWallBackdrop>> {
  return walls.map((w) => {
    const b = backdrops[w.id];
    return b ? { ...w, ...b } : w;
  });
}
