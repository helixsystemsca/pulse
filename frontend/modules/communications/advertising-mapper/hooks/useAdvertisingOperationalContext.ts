"use client";

import { useMemo } from "react";
import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";
import type { SpatialOperationalContext } from "@/spatial-engine/operations/types";
import { useSpatialOperationalLayer } from "@/spatial-engine/hooks/useSpatialOperationalLayer";

/** Advertising workspace — signage occupancy and revenue overlays from inventory blocks. */
export function useAdvertisingOperationalContext(wall: FacilityWallPlan | null) {
  const context = useMemo((): SpatialOperationalContext => {
    if (!wall) return {};
    return {
      sponsorships: wall.blocks.map((b) => ({
        inventoryItemId: b.id,
        sponsorName: b.sponsor ?? b.name,
        contractId: b.inventoryId,
        occupancyPct: b.status === "occupied" ? 100 : b.status === "reserved" ? 50 : 0,
      })),
    };
  }, [wall]);

  return useSpatialOperationalLayer(context);
}
