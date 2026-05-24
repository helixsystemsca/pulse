import type { WidgetHeightTier } from "@/lib/dashboard/workspace-layout";
import type { WorkRequestsLayoutMode } from "@/lib/dashboard/snap/work-requests";

/** Fixed layout mode by tier — KPI cell size stays constant; only grid arrangement changes. */
export function workRequestsLayoutForTier(tier: WidgetHeightTier): WorkRequestsLayoutMode {
  if (tier === "tall") return "1x4";
  if (tier === "expanded") return "2x2";
  return "4x1";
}

export function routineAssignmentRowCap(tier: WidgetHeightTier): {
  maxAssignments: number;
  maxRoutines: number;
} {
  if (tier === "compact") return { maxAssignments: 3, maxRoutines: 2 };
  if (tier === "medium") return { maxAssignments: 4, maxRoutines: 3 };
  if (tier === "expanded") return { maxAssignments: 6, maxRoutines: 5 };
  return { maxAssignments: 10, maxRoutines: 8 };
}

export function elasticListRowCap(tier: WidgetHeightTier): number {
  if (tier === "compact") return 3;
  if (tier === "medium") return 4;
  if (tier === "expanded") return 6;
  return 10;
}

export function facilityScheduleRowCap(tier: WidgetHeightTier): {
  maxLocations: number;
  maxPerLocation: number;
} {
  if (tier === "compact") return { maxLocations: 2, maxPerLocation: 2 };
  if (tier === "medium") return { maxLocations: 3, maxPerLocation: 4 };
  if (tier === "expanded") return { maxLocations: 5, maxPerLocation: 6 };
  return { maxLocations: 8, maxPerLocation: 10 };
}

export function workforceShowsSecondarySections(tier: WidgetHeightTier): boolean {
  return tier === "expanded" || tier === "tall";
}
