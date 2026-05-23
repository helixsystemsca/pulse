import {
  DEFAULT_WORKABLE_HEIGHT_INCHES,
  DEFAULT_WORKABLE_WIDTH_INCHES,
} from "@/modules/communications/advertising-mapper/lib/wall-workable-area";
import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";

/** Blank viewport document for the arena advertising mapper. */
export function createEmptyWallPlan(opts?: { id?: string; name?: string }): FacilityWallPlan {
  const id = opts?.id ?? `view-${Date.now()}`;
  return {
    id,
    name: opts?.name?.trim() || "New view",
    width_inches: DEFAULT_WORKABLE_WIDTH_INCHES,
    height_inches: DEFAULT_WORKABLE_HEIGHT_INCHES,
    backdropKind: "arena",
    gridSnapInches: 6,
    constraints: [],
    blocks: [],
  };
}
