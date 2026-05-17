"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  wallPlanToDocument,
  type AdvertisingWallDomain,
} from "@/spatial-engine/persistence/advertising-adapter";
import {
  patchInventoryItem,
  patchConstraintFeature,
  addConstraintFeature,
  addInventoryItem,
  removeConstraintFeature,
  removeInventoryItem,
  patchDocumentBackdrop,
  patchDocumentMetadata,
} from "@/spatial-engine/runtime/document-mutations";
import {
  selectActiveDocument,
  selectActiveDocumentRevision,
  useSpatialRuntimeStore,
} from "@/spatial-engine/runtime/spatial-runtime-store";
import { wallPlanFromDocument } from "@/spatial-engine/runtime/selectors";
import type { ConstraintRegion } from "@/modules/communications/advertising-mapper/geometry/types";
import type { FacilityWallPlan, InventoryBlock } from "@/modules/communications/advertising-mapper/types";
import type { ConstraintFeatureDocument, InventoryItemDocument } from "@/spatial-engine/document/layers";

function blockToInventoryItem(block: InventoryBlock): InventoryItemDocument {
  return {
    id: block.id,
    geometry: {
      kind: "rect",
      x: block.x,
      y: block.y,
      width: block.width_inches,
      height: block.height_inches,
    },
    metadata: {
      name: block.name,
      status: block.status,
      sponsor: block.sponsor,
      zone: block.zone,
      visibilityTier: block.visibilityTier,
      priceTier: block.priceTier,
      inventoryId: block.inventoryId,
      mountingType: block.mountingType,
      expiryDate: block.expiryDate,
      assetUrl: block.assetUrl,
    },
  };
}

function constraintToFeature(region: ConstraintRegion): ConstraintFeatureDocument {
  return {
    id: region.id,
    geometry: { kind: "polygon", points: region.points },
    metadata: {
      constraintType: region.constraintType,
      label: region.label,
      notes: region.notes,
      createdAt: region.createdAt,
      updatedAt: region.updatedAt,
    },
  };
}

/**
 * Advertising workspace runtime — `SpatialDocument` is the source of truth per wall.
 */
export function useAdvertisingSpatialRuntime(initialWalls: FacilityWallPlan[], initialWallId: string) {
  const loadDocument = useSpatialRuntimeStore((s) => s.loadDocument);
  const resetSession = useSpatialRuntimeStore((s) => s.resetSession);
  const setActiveDocumentId = useSpatialRuntimeStore((s) => s.setActiveDocumentId);
  const updateActiveDocument = useSpatialRuntimeStore((s) => s.updateActiveDocument);
  const activeDocumentId = useSpatialRuntimeStore((s) => s.session.activeDocumentId);
  const documents = useSpatialRuntimeStore((s) => s.documents);
  const revision = useSpatialRuntimeStore(selectActiveDocumentRevision);
  const activeDocument = useSpatialRuntimeStore(selectActiveDocument);

  useEffect(() => {
    resetSession("advertising");
    for (const w of initialWalls) {
      loadDocument(wallPlanToDocument(w), { pushHistory: false });
    }
    setActiveDocumentId(initialWallId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once
  }, []);

  const walls = useMemo((): FacilityWallPlan[] => {
    return Object.values(documents)
      .map((e) => wallPlanFromDocument(e.document))
      .filter((w): w is AdvertisingWallDomain => Boolean(w)) as FacilityWallPlan[];
  }, [documents]);

  const wallId = activeDocumentId ?? initialWallId;

  const wall = useMemo(
    () => wallPlanFromDocument(activeDocument) as FacilityWallPlan | null,
    [activeDocument, revision],
  );

  const setWallId = useCallback(
    (id: string) => {
      setActiveDocumentId(id);
    },
    [setActiveDocumentId],
  );

  const updateWall = useCallback(
    (patch: Partial<FacilityWallPlan>) => {
      updateActiveDocument((doc) => {
        const current = wallPlanFromDocument(doc);
        if (!current) return doc;
        let next = wallPlanToDocument({ ...current, ...patch });
        if (patch.backdropUrl !== undefined || patch.backdropNaturalWidth !== undefined) {
          next = patchDocumentBackdrop(next, {
            kind: patch.backdropUrl ? "image" : "none",
            url: patch.backdropUrl,
            naturalWidth: patch.backdropNaturalWidth,
            naturalHeight: patch.backdropNaturalHeight,
            variant: current.backdropKind,
          });
        }
        if (patch.name !== undefined) {
          next = patchDocumentMetadata(next, { title: patch.name });
        }
        return next;
      });
    },
    [updateActiveDocument],
  );

  const onBlockChange = useCallback(
    (id: string, patch: Partial<InventoryBlock>) => {
      updateActiveDocument((doc) => {
        const geom: Partial<InventoryItemDocument["geometry"]> = {};
        if (patch.x !== undefined) geom.x = patch.x;
        if (patch.y !== undefined) geom.y = patch.y;
        if (patch.width_inches !== undefined) geom.width = patch.width_inches;
        if (patch.height_inches !== undefined) geom.height = patch.height_inches;
        const meta: Record<string, unknown> = {};
        if (patch.name !== undefined) meta.name = patch.name;
        if (patch.status !== undefined) meta.status = patch.status;
        if (patch.sponsor !== undefined) meta.sponsor = patch.sponsor;
        return patchInventoryItem(doc, id, {
          ...(Object.keys(geom).length ? { geometry: geom as InventoryItemDocument["geometry"] } : {}),
          ...(Object.keys(meta).length ? { metadata: meta } : {}),
        });
      });
    },
    [updateActiveDocument],
  );

  const onConstraintChange = useCallback(
    (id: string, patch: Partial<ConstraintRegion>) => {
      updateActiveDocument((doc) => {
        if (patch.points) {
          return patchConstraintFeature(doc, id, {
            geometry: { kind: "polygon", points: patch.points },
          });
        }
        const meta: Record<string, unknown> = {};
        if (patch.constraintType !== undefined) meta.constraintType = patch.constraintType;
        if (patch.label !== undefined) meta.label = patch.label;
        if (patch.notes !== undefined) meta.notes = patch.notes;
        return patchConstraintFeature(doc, id, { metadata: meta });
      });
    },
    [updateActiveDocument],
  );

  const onConstraintCreate = useCallback(
    (region: ConstraintRegion) => {
      updateActiveDocument((doc) => addConstraintFeature(doc, constraintToFeature(region)));
    },
    [updateActiveDocument],
  );

  const onConstraintDelete = useCallback(
    (id: string) => {
      updateActiveDocument((doc) => removeConstraintFeature(doc, id));
    },
    [updateActiveDocument],
  );

  const addBlock = useCallback(
    (block: InventoryBlock) => {
      updateActiveDocument((doc) => addInventoryItem(doc, blockToInventoryItem(block)));
    },
    [updateActiveDocument],
  );

  const removeBlock = useCallback(
    (id: string) => {
      updateActiveDocument((doc) => removeInventoryItem(doc, id));
    },
    [updateActiveDocument],
  );

  return {
    walls,
    wallId,
    wall,
    setWallId,
    updateWall,
    onBlockChange,
    onConstraintChange,
    onConstraintCreate,
    onConstraintDelete,
    addBlock,
    removeBlock,
    activeDocument,
    revision,
  };
}
