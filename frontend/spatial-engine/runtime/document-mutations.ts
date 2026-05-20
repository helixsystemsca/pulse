import {
  createAnnotationLayer,
  createConstraintLayer,
  createDeviceLayer,
  createGraphLayer,
  createInventoryLayer,
  createZoneLayer,
  type AnnotationFeatureDocument,
  type ConstraintFeatureDocument,
  type DeviceFeatureDocument,
  type GraphEdgeDocument,
  type GraphNodeDocument,
  type InventoryItemDocument,
  type SpatialDocumentLayer,
  type ZoneFeatureDocument,
} from "@/spatial-engine/document/layers";
import { getDocumentLayer, requireDocumentLayer } from "@/spatial-engine/document/query";
import type { SpatialDocument } from "@/spatial-engine/document/types";

function replaceLayer(doc: SpatialDocument, layer: SpatialDocumentLayer): SpatialDocument {
  const idx = doc.layers.findIndex((l) => l.id === layer.id || l.type === layer.type);
  const layers =
    idx >= 0
      ? doc.layers.map((l, i) => (i === idx ? layer : l))
      : [...doc.layers, layer];
  return { ...doc, layers, metadata: { ...doc.metadata, updatedAt: new Date().toISOString() } };
}

export function upsertGraphLayer(
  doc: SpatialDocument,
  nodes: GraphNodeDocument[],
  edges: GraphEdgeDocument[],
): SpatialDocument {
  const existing = getDocumentLayer(doc, "graph");
  const layer = createGraphLayer(
    existing ? { id: existing.id, visible: existing.visible, zIndex: existing.zIndex, persistence: existing.persistence } : { id: "graph", visible: true, zIndex: 20 },
    nodes,
    edges,
  );
  return replaceLayer(doc, layer);
}

export function upsertInventoryLayer(doc: SpatialDocument, items: InventoryItemDocument[]): SpatialDocument {
  const existing = getDocumentLayer(doc, "inventory");
  const layer = createInventoryLayer(
    existing ? { id: existing.id, visible: existing.visible, zIndex: existing.zIndex, persistence: existing.persistence } : { id: "inventory", visible: true, zIndex: 20 },
    items,
  );
  return replaceLayer(doc, layer);
}

export function upsertConstraintLayer(doc: SpatialDocument, features: ConstraintFeatureDocument[]): SpatialDocument {
  const existing = getDocumentLayer(doc, "constraints");
  const layer = createConstraintLayer(
    existing ? { id: existing.id, visible: existing.visible, zIndex: existing.zIndex, persistence: existing.persistence } : { id: "constraints", visible: true, zIndex: 10 },
    features,
  );
  return replaceLayer(doc, layer);
}

export function upsertAnnotationLayer(doc: SpatialDocument, features: AnnotationFeatureDocument[]): SpatialDocument {
  const existing = getDocumentLayer(doc, "annotations");
  const layer = createAnnotationLayer(
    existing ? { id: existing.id, visible: existing.visible, zIndex: existing.zIndex, persistence: existing.persistence } : { id: "annotations", visible: true, zIndex: 30 },
    features,
  );
  return replaceLayer(doc, layer);
}

export function upsertZoneLayer(doc: SpatialDocument, features: ZoneFeatureDocument[]): SpatialDocument {
  const existing = getDocumentLayer(doc, "zones");
  const layer = createZoneLayer(
    existing ? { id: existing.id, visible: existing.visible, zIndex: existing.zIndex, persistence: existing.persistence } : { id: "zones", visible: true, zIndex: 15 },
    features,
  );
  return replaceLayer(doc, layer);
}

export function upsertDeviceLayer(doc: SpatialDocument, features: DeviceFeatureDocument[]): SpatialDocument {
  const existing = getDocumentLayer(doc, "devices");
  const layer = createDeviceLayer(
    existing ? { id: existing.id, visible: existing.visible, zIndex: existing.zIndex, persistence: existing.persistence } : { id: "devices", visible: true, zIndex: 25 },
    features,
  );
  return replaceLayer(doc, layer);
}

export function patchGraphNode(
  doc: SpatialDocument,
  nodeId: string,
  patch: Partial<GraphNodeDocument> & { position?: GraphNodeDocument["position"] },
): SpatialDocument {
  const graph = requireDocumentLayer(doc, "graph");
  const nodes = graph.nodes.map((n) =>
    n.id === nodeId
      ? {
          ...n,
          ...patch,
          position: patch.position ? { ...patch.position } : n.position,
          metadata: patch.metadata ? { ...n.metadata, ...patch.metadata } : n.metadata,
        }
      : n,
  );
  return upsertGraphLayer(doc, nodes, graph.edges);
}

export function patchInventoryItem(
  doc: SpatialDocument,
  itemId: string,
  patch: Partial<InventoryItemDocument> & { geometry?: Partial<InventoryItemDocument["geometry"]> },
): SpatialDocument {
  const inv = requireDocumentLayer(doc, "inventory");
  const items = inv.items.map((item) => {
    if (item.id !== itemId) return item;
    return {
      ...item,
      ...patch,
      geometry: patch.geometry ? { ...item.geometry, ...patch.geometry } : item.geometry,
      metadata: patch.metadata ? { ...item.metadata, ...patch.metadata } : item.metadata,
    };
  });
  return upsertInventoryLayer(doc, items);
}

export function addInventoryItem(doc: SpatialDocument, item: InventoryItemDocument): SpatialDocument {
  const inv = getDocumentLayer(doc, "inventory");
  const items = [...(inv?.items ?? []), item];
  return upsertInventoryLayer(doc, items);
}

export function removeInventoryItem(doc: SpatialDocument, itemId: string): SpatialDocument {
  const inv = requireDocumentLayer(doc, "inventory");
  return upsertInventoryLayer(
    doc,
    inv.items.filter((i) => i.id !== itemId),
  );
}

export function addConstraintFeature(doc: SpatialDocument, feature: ConstraintFeatureDocument): SpatialDocument {
  const layer = getDocumentLayer(doc, "constraints");
  const features = [...(layer?.features ?? []), feature];
  return upsertConstraintLayer(doc, features);
}

export function patchConstraintFeature(
  doc: SpatialDocument,
  featureId: string,
  patch: Partial<ConstraintFeatureDocument>,
): SpatialDocument {
  const layer = requireDocumentLayer(doc, "constraints");
  const features = layer.features.map((f) =>
    f.id === featureId
      ? {
          ...f,
          ...patch,
          geometry: patch.geometry ? { kind: patch.geometry.kind, points: [...patch.geometry.points] } : f.geometry,
          metadata: patch.metadata ? { ...f.metadata, ...patch.metadata } : f.metadata,
        }
      : f,
  );
  return upsertConstraintLayer(doc, features);
}

export function removeConstraintFeature(doc: SpatialDocument, featureId: string): SpatialDocument {
  const layer = requireDocumentLayer(doc, "constraints");
  return upsertConstraintLayer(
    doc,
    layer.features.filter((f) => f.id !== featureId),
  );
}

export function patchDocumentBackdrop(doc: SpatialDocument, backdrop: SpatialDocument["backdrop"]): SpatialDocument {
  return { ...doc, backdrop: { ...backdrop }, metadata: { ...doc.metadata, updatedAt: new Date().toISOString() } };
}

export function patchDocumentMetadata(
  doc: SpatialDocument,
  metadata: Partial<SpatialDocument["metadata"]>,
): SpatialDocument {
  return {
    ...doc,
    metadata: { ...doc.metadata, ...metadata, updatedAt: new Date().toISOString() },
  };
}
