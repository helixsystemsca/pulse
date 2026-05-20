"use client";

import { useEffect, useMemo } from "react";
import {
  buildConstraintOperationalWarnings,
  buildOperationalOverlays,
  buildSafetyZoneOverlays,
  constraintWarningsToOverlay,
  mergeOperationalOverlayVisibility,
} from "@/spatial-engine/operations";
import type {
  SpatialOperationalContext,
  SpatialOperationalOverlay,
} from "@/spatial-engine/operations/types";

function operationalOverlaysEqual(
  a: readonly SpatialOperationalOverlay[],
  b: readonly SpatialOperationalOverlay[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (left.id !== right.id || left.visible !== right.visible || left.points.length !== right.points.length) {
      return false;
    }
  }
  return true;
}
import {
  selectActiveDocument,
  selectActiveDocumentRevision,
  useSpatialRuntimeStore,
} from "@/spatial-engine/runtime/spatial-runtime-store";

/**
 * Recomputes operational overlays when document or context changes and syncs to runtime store.
 */
export function useSpatialOperationalLayer(context: SpatialOperationalContext = {}) {
  const activeDocument = useSpatialRuntimeStore(selectActiveDocument);
  const revision = useSpatialRuntimeStore(selectActiveDocumentRevision);
  const toggles = useSpatialRuntimeStore((s) => s.session.operationalLayerToggles);
  const visibility = useSpatialRuntimeStore((s) => s.session.overlayVisibility);
  const overlays = useSpatialRuntimeStore((s) => s.session.operationalOverlays);
  const setOperationalOverlays = useSpatialRuntimeStore((s) => s.setOperationalOverlays);
  const setOverlayVisible = useSpatialRuntimeStore((s) => s.setOverlayVisible);
  const setOperationalLayerToggles = useSpatialRuntimeStore((s) => s.setOperationalLayerToggles);

  const computed = useMemo(() => {
    if (!activeDocument) return [];
    const base = buildOperationalOverlays(activeDocument, context, toggles);
    const warnings = toggles.constraintWarnings
      ? buildConstraintOperationalWarnings(activeDocument)
      : [];
    const warningOverlay = constraintWarningsToOverlay(warnings);
    const safety = toggles.constraintWarnings ? buildSafetyZoneOverlays(activeDocument) : [];
    const merged = [
      ...base,
      ...(warningOverlay ? [warningOverlay] : []),
      ...safety,
    ];
    return mergeOperationalOverlayVisibility(merged, visibility);
  }, [activeDocument, revision, context, toggles, visibility]);

  useEffect(() => {
    if (operationalOverlaysEqual(overlays, computed)) return;
    setOperationalOverlays(computed);
  }, [computed, overlays, setOperationalOverlays]);

  return {
    overlays,
    setOverlayVisible,
    setOperationalLayerToggles,
    toggles,
  };
}
