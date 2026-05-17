import {
  isAnnotationLayer,
  isConstraintLayer,
  isGraphLayer,
  isInventoryLayer,
  isSensorLayer,
  type SpatialDocumentLayer,
  type SpatialDocumentLayerType,
} from "@/spatial-engine/document/layers/types";
import type { SpatialDocument } from "@/spatial-engine/document/types";

export function getDocumentLayer<T extends SpatialDocumentLayerType>(
  doc: SpatialDocument,
  type: T,
): Extract<SpatialDocumentLayer, { type: T }> | undefined {
  return doc.layers.find((l): l is Extract<SpatialDocumentLayer, { type: T }> => l.type === type);
}

export function requireDocumentLayer<T extends SpatialDocumentLayerType>(
  doc: SpatialDocument,
  type: T,
): Extract<SpatialDocumentLayer, { type: T }> {
  const layer = getDocumentLayer(doc, type);
  if (!layer) throw new Error(`Spatial document missing layer: ${type}`);
  return layer;
}

export function sortedDocumentLayers(doc: SpatialDocument): SpatialDocumentLayer[] {
  return [...doc.layers].sort((a, b) => a.zIndex - b.zIndex);
}

export function visibleDocumentLayers(doc: SpatialDocument): SpatialDocumentLayer[] {
  return sortedDocumentLayers(doc).filter((l) => l.visible);
}

export { isAnnotationLayer, isConstraintLayer, isGraphLayer, isInventoryLayer, isSensorLayer };
