"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
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
import {
  fetchAdvertisingWalls,
  saveAdvertisingWalls,
  uploadAdvertisingWallBackdropDataUrl,
} from "@/lib/advertising/advertisingWallsService";
import { isApiMode } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";
import {
  loadPersistedAdvertisingWalls,
  savePersistedAdvertisingWalls,
} from "@/modules/communications/advertising-mapper/lib/advertising-wall-plans-storage";
import {
  loadAllWallBackdrops,
  mergeWallPlanBackdrops,
} from "@/modules/communications/advertising-mapper/lib/advertising-wall-backdrop-storage";
import { getDefaultAdvertisingWallScaffolds } from "@/modules/communications/advertising-mapper/data/mock-walls";
import { createEmptyWallPlan } from "@/modules/communications/advertising-mapper/lib/create-wall-plan";
import type { ConstraintRegion } from "@/modules/communications/advertising-mapper/geometry/types";
import type { FacilityWallPlan, InventoryBlock } from "@/modules/communications/advertising-mapper/types";
import {
  inventoryBlockToMetadata,
  inventoryMetadataPatch,
} from "@/modules/communications/advertising-mapper/lib/inventory-metadata";
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
    metadata: inventoryBlockToMetadata(block),
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
export function useAdvertisingSpatialRuntime(initialWallId = "left") {
  const loadDocument = useSpatialRuntimeStore((s) => s.loadDocument);
  const resetSession = useSpatialRuntimeStore((s) => s.resetSession);
  const setActiveDocumentId = useSpatialRuntimeStore((s) => s.setActiveDocumentId);
  const updateActiveDocument = useSpatialRuntimeStore((s) => s.updateActiveDocument);
  const activeDocumentId = useSpatialRuntimeStore((s) => s.session.activeDocumentId);
  const documents = useSpatialRuntimeStore((s) => s.documents);
  const revision = useSpatialRuntimeStore(selectActiveDocumentRevision);
  const activeDocument = useSpatialRuntimeStore(selectActiveDocument);
  const hydratedRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const companyId = readSession()?.company_id ?? null;

  useEffect(() => {
    resetSession("advertising");
    let cancelled = false;

    async function hydrate() {
      let base: FacilityWallPlan[] | null = null;
      if (isApiMode()) {
        try {
          const remote = await fetchAdvertisingWalls(companyId);
          if (remote.length) base = remote;
        } catch {
          /* fall back to local cache */
        }
      }
      if (!base?.length) {
        base = loadPersistedAdvertisingWalls() ?? getDefaultAdvertisingWallScaffolds();
        const storedBackdrops = loadAllWallBackdrops();
        base = mergeWallPlanBackdrops(base, storedBackdrops) as FacilityWallPlan[];
      }
      if (cancelled) return;
      for (const w of base) {
        loadDocument(wallPlanToDocument(w), { pushHistory: false });
      }
      const activeId = base.some((w) => w.id === initialWallId)
        ? initialWallId
        : (base[0]?.id ?? initialWallId);
      setActiveDocumentId(activeId);
      hydratedRef.current = true;
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once
  }, []);

  const walls = useMemo((): FacilityWallPlan[] => {
    return Object.values(documents)
      .map((e) => wallPlanFromDocument(e.document))
      .filter((w): w is AdvertisingWallDomain => Boolean(w)) as FacilityWallPlan[];
  }, [documents, revision]);

  useEffect(() => {
    if (!hydratedRef.current || Object.keys(documents).length === 0) return;
    const t = window.setTimeout(() => {
      if (isApiMode()) {
        if (saveInFlightRef.current) return;
        saveInFlightRef.current = true;
        void saveAdvertisingWalls(walls, companyId)
          .catch(() => {
            savePersistedAdvertisingWalls(walls);
          })
          .finally(() => {
            saveInFlightRef.current = false;
          });
      } else {
        savePersistedAdvertisingWalls(walls);
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [walls, documents, companyId]);

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
            if (
            patch.backdropUrl &&
            patch.backdropNaturalWidth &&
            patch.backdropNaturalHeight &&
            patch.backdropUrl.startsWith("data:") &&
            isApiMode()
          ) {
            const wallId = doc.id;
            const nw = patch.backdropNaturalWidth;
            const nh = patch.backdropNaturalHeight;
            const dataUrl = patch.backdropUrl;
            void (async () => {
              try {
                await saveAdvertisingWalls(walls, companyId);
                const out = await uploadAdvertisingWallBackdropDataUrl(wallId, dataUrl, companyId);
                updateActiveDocument((inner) =>
                  patchDocumentBackdrop(inner, {
                    kind: "image",
                    url: out.backdrop_url,
                    naturalWidth: nw,
                    naturalHeight: nh,
                    variant: current.backdropKind,
                  }),
                );
              } catch {
                /* keep data URL until next save attempt */
              }
            })();
          }
        }
        if (patch.name !== undefined) {
          next = patchDocumentMetadata(next, { title: patch.name });
        }
        return next;
      });
    },
    [companyId, updateActiveDocument, walls],
  );

  const onBlockChange = useCallback(
    (id: string, patch: Partial<InventoryBlock>) => {
      updateActiveDocument((doc) => {
        const geom: Partial<InventoryItemDocument["geometry"]> = {};
        if (patch.x !== undefined) geom.x = patch.x;
        if (patch.y !== undefined) geom.y = patch.y;
        if (patch.width_inches !== undefined) geom.width = patch.width_inches;
        if (patch.height_inches !== undefined) geom.height = patch.height_inches;
        const meta = inventoryMetadataPatch(patch);
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

  const addWall = useCallback(() => {
    const existing = Object.values(documents).length;
    const plan = createEmptyWallPlan({ name: `View ${existing + 1}` });
    loadDocument(wallPlanToDocument(plan), { pushHistory: false });
    setActiveDocumentId(plan.id);
    return plan.id;
  }, [documents, loadDocument, setActiveDocumentId]);

  return {
    walls,
    wallId,
    wall,
    setWallId,
    updateWall,
    addWall,
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
