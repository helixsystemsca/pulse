import type { ReactNode } from "react";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import type { SpatialDocumentLayer, SpatialDocumentLayerType } from "@/spatial-engine/document/layers/types";
import type { SpatialViewport } from "@/spatial-engine/types/spatial";
import type { SpatialSelectionState } from "@/spatial-engine/selection/types";
import { visibleDocumentLayers } from "@/spatial-engine/document/query";

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
