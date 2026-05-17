"use client";

import type { ReactNode } from "react";
import {
  registerSpatialLayerRenderer,
  type SpatialLayerRenderContext,
} from "@/spatial-engine/runtime/render-pipeline";

/** Placeholder until Konva adapters consume `renderSpatialDocumentLayers`. */
function noopLayer(type: SpatialLayerRenderContext["layer"]["type"]) {
  registerSpatialLayerRenderer({
    layerType: type,
    render: () => null as ReactNode,
  });
}

let registered = false;

/** Idempotent registration for drawings workspace canvas composition. */
export function ensureDrawingsSpatialRenderers(): void {
  if (registered) return;
  registered = true;
  for (const type of ["graph", "zones", "devices", "annotations"] as const) {
    noopLayer(type);
  }
}
