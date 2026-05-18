"use client";

import { useEffect, useMemo, useState } from "react";
import { isApiMode } from "@/lib/api";
import { fetchWorkOrders, type WorkOrderRow } from "@/lib/cmmsApi";
import type { SpatialOperationalContext } from "@/spatial-engine/operations/types";
import { useSpatialOperationalLayer } from "@/spatial-engine/hooks/useSpatialOperationalLayer";
import {
  graphAssetsFromDocument,
  selectActiveDocument,
  selectActiveDocumentRevision,
  useSpatialRuntimeStore,
} from "@/spatial-engine/runtime";

function mapWorkOrders(rows: WorkOrderRow[]): SpatialOperationalContext["workOrders"] {
  return rows.map((wo) => ({
    id: wo.id,
    title: wo.title,
    status: wo.status,
    assetId: wo.asset_id,
    zoneId: wo.zone_id ?? null,
    equipmentId: wo.equipment_id ?? null,
    severity:
      wo.status === "hold"
        ? ("critical" as const)
        : wo.status === "in_progress" || wo.status === "open"
          ? ("warning" as const)
          : ("normal" as const),
  }));
}

/**
 * Infrastructure workspace — loads CMMS work orders and projects operational overlays onto the map.
 */
export function useInfrastructureOperationalContext(mapId: string | null) {
  const activeDocument = useSpatialRuntimeStore(selectActiveDocument);
  const revision = useSpatialRuntimeStore(selectActiveDocumentRevision);
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);

  useEffect(() => {
    if (!isApiMode()) {
      setWorkOrders([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchWorkOrders();
        if (!cancelled) setWorkOrders(list ?? []);
      } catch {
        if (!cancelled) setWorkOrders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  const context = useMemo((): SpatialOperationalContext => {
    const assets = graphAssetsFromDocument(activeDocument);
    const assetPositions = new Map(assets.map((a) => [a.id, { x: a.x, y: a.y }]));
    const workOrdersWithPositions = mapWorkOrders(workOrders)?.map((wo) => {
      const pos =
        (wo.assetId && assetPositions.get(wo.assetId)) ||
        (wo.equipmentId && assetPositions.get(wo.equipmentId)) ||
        undefined;
      return pos ? { ...wo, position: pos } : wo;
    });
    return { workOrders: workOrdersWithPositions };
  }, [activeDocument, revision, workOrders]);

  return useSpatialOperationalLayer(context);
}
