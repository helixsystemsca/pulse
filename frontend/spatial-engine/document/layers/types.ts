import type { FlatPolygonPoints, WorldPoint, WorldRect } from "@/spatial-engine/types/spatial";

/** Layer types supported by the spatial document model. */
export type SpatialDocumentLayerType =
  | "inventory"
  | "constraints"
  | "graph"
  | "annotations"
  | "sensors";

export type LayerPersistenceBinding = {
  /** Registry key for domain persistence adapter slice (e.g. `advertising.inventory`). */
  adapterKey: string;
  /** Optional external collection/table identifier. */
  collectionId?: string;
};

export type SpatialLayerBase = {
  id: string;
  type: SpatialDocumentLayerType;
  visible: boolean;
  locked?: boolean;
  opacity?: number;
  zIndex: number;
  label?: string;
  persistence?: LayerPersistenceBinding;
};

// —— Inventory ——

export type InventoryGeometryKind = "rect";

export type InventoryItemGeometry = {
  kind: InventoryGeometryKind;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type InventoryItemDocument = {
  id: string;
  geometry: InventoryItemGeometry;
  /** Domain fields (sponsor, status, pricing tier, …) — JSON-serializable. */
  metadata: Record<string, unknown>;
};

export type InventoryLayerDocument = SpatialLayerBase & {
  type: "inventory";
  items: InventoryItemDocument[];
};

// —— Constraints ——

export type ConstraintGeometryKind = "polygon";

export type ConstraintFeatureDocument = {
  id: string;
  geometry: {
    kind: ConstraintGeometryKind;
    points: FlatPolygonPoints;
  };
  metadata: Record<string, unknown>;
};

export type ConstraintLayerDocument = SpatialLayerBase & {
  type: "constraints";
  features: ConstraintFeatureDocument[];
};

// —— Graph (infrastructure) ——

export type GraphNodeDocument = {
  id: string;
  position: WorldPoint;
  metadata: Record<string, unknown>;
};

export type GraphEdgeDocument = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  metadata: Record<string, unknown>;
};

export type GraphLayerDocument = SpatialLayerBase & {
  type: "graph";
  nodes: GraphNodeDocument[];
  edges: GraphEdgeDocument[];
};

// —— Annotations ——

export type AnnotationGeometryKind = "point" | "rect" | "polygon" | "polyline" | "symbol";

export type AnnotationFeatureDocument = {
  id: string;
  geometry:
    | { kind: "point"; position: WorldPoint }
    | { kind: "rect"; rect: WorldRect }
    | { kind: "polygon"; points: FlatPolygonPoints }
    | { kind: "polyline"; points: FlatPolygonPoints }
    | { kind: "symbol"; position: WorldPoint; symbolType: string };
  metadata: Record<string, unknown>;
};

export type AnnotationLayerDocument = SpatialLayerBase & {
  type: "annotations";
  features: AnnotationFeatureDocument[];
};

// —— Sensors (future overlays) ——

export type SensorFeatureDocument = {
  id: string;
  position: WorldPoint;
  sensorType: string;
  metadata: Record<string, unknown>;
};

export type SensorLayerDocument = SpatialLayerBase & {
  type: "sensors";
  features: SensorFeatureDocument[];
};

export type SpatialDocumentLayer =
  | InventoryLayerDocument
  | ConstraintLayerDocument
  | GraphLayerDocument
  | AnnotationLayerDocument
  | SensorLayerDocument;

export function isInventoryLayer(layer: SpatialDocumentLayer): layer is InventoryLayerDocument {
  return layer.type === "inventory";
}

export function isConstraintLayer(layer: SpatialDocumentLayer): layer is ConstraintLayerDocument {
  return layer.type === "constraints";
}

export function isGraphLayer(layer: SpatialDocumentLayer): layer is GraphLayerDocument {
  return layer.type === "graph";
}

export function isAnnotationLayer(layer: SpatialDocumentLayer): layer is AnnotationLayerDocument {
  return layer.type === "annotations";
}

export function isSensorLayer(layer: SpatialDocumentLayer): layer is SensorLayerDocument {
  return layer.type === "sensors";
}
