import type { ReactNode } from "react";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import type { SpatialDocumentLayer, SpatialDocumentLayerType } from "@/spatial-engine/document/layers/types";
import type { SpatialViewport } from "@/spatial-engine/types/spatial";
import type { SpatialSelectionState } from "@/spatial-engine/selection/types";
import { visibleDocumentLayers } from "@/spatial-engine/document/query";
import type { SpatialOperationalOverlay } from "@/spatial-engine/operations/types";

export type SpatialLayerRenderContext = {
  document: SpatialDocument;
  layer: SpatialDocumentLayer;
  viewport: SpatialViewport;
  selection: SpatialSelectionState;
};

export type SpatialLayerRenderer = {
  layerType: SpatialDocumentLayerType;
  render: (ctx: SpatialLayerRenderContext) => ReactNode;
};

const registry = new Map<SpatialDocumentLayerType, SpatialLayerRenderer>();

export function registerSpatialLayerRenderer(renderer: SpatialLayerRenderer): void {
  registry.set(renderer.layerType, renderer);
}

export function getSpatialLayerRenderer(type: SpatialDocumentLayerType): SpatialLayerRenderer | undefined {
  return registry.get(type);
}

/** Compose visible layers through registered renderers (workspace registers Konva adapters). */
export function renderSpatialDocumentLayers(
  doc: SpatialDocument,
  viewport: SpatialViewport,
  selection: SpatialSelectionState,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  for (const layer of visibleDocumentLayers(doc)) {
    const renderer = registry.get(layer.type);
    if (!renderer) continue;
    nodes.push(
      renderer.render({
        document: doc,
        layer,
        viewport,
        selection,
      }),
    );
  }
  return nodes;
}

export function clearSpatialLayerRenderers(): void {
  registry.clear();
}

/** Transient operational overlay renderer (WO pins, telemetry heatmaps, …). */
export type SpatialOperationalOverlayRenderer = {
  render: (ctx: {
    document: SpatialDocument;
    overlay: SpatialOperationalOverlay;
    viewport: SpatialViewport;
    selection: SpatialSelectionState;
  }) => ReactNode;
};

let operationalRenderer: SpatialOperationalOverlayRenderer | null = null;

export function registerOperationalOverlayRenderer(renderer: SpatialOperationalOverlayRenderer): void {
  operationalRenderer = renderer;
}

export function renderOperationalOverlays(
  doc: SpatialDocument,
  overlays: SpatialOperationalOverlay[],
  viewport: SpatialViewport,
  selection: SpatialSelectionState,
): ReactNode[] {
  if (!operationalRenderer) return [];
  return overlays
    .filter((o) => o.visible)
    .map((overlay) =>
      operationalRenderer!.render({ document: doc, overlay, viewport, selection }),
    );
}
