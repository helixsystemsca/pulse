import type {
  AnnotationLayerDocument,
  ConstraintLayerDocument,
  GraphLayerDocument,
  InventoryLayerDocument,
  SensorLayerDocument,
  SpatialDocumentLayerType,
  SpatialLayerBase,
} from "@/spatial-engine/document/layers/types";

const DEFAULT_Z: Record<SpatialDocumentLayerType, number> = {
  inventory: 20,
  constraints: 10,
  graph: 20,
  annotations: 30,
  sensors: 40,
};

type LayerShell = Pick<SpatialLayerBase, "id" | "visible" | "locked" | "opacity" | "zIndex" | "label" | "persistence">;

function shell(type: SpatialDocumentLayerType, partial?: Partial<LayerShell>): LayerShell {
  return {
    id: partial?.id ?? type,
    visible: partial?.visible ?? true,
    locked: partial?.locked,
    opacity: partial?.opacity,
    zIndex: partial?.zIndex ?? DEFAULT_Z[type],
    label: partial?.label,
    persistence: partial?.persistence,
  };
}

export function createInventoryLayer(partial?: Partial<LayerShell>, items: InventoryLayerDocument["items"] = []): InventoryLayerDocument {
  const s = shell("inventory", partial);
  return { ...s, type: "inventory", items };
}

export function createConstraintLayer(
  partial?: Partial<LayerShell>,
  features: ConstraintLayerDocument["features"] = [],
): ConstraintLayerDocument {
  const s = shell("constraints", partial);
  return { ...s, type: "constraints", features };
}

export function createGraphLayer(
  partial?: Partial<LayerShell>,
  nodes: GraphLayerDocument["nodes"] = [],
  edges: GraphLayerDocument["edges"] = [],
): GraphLayerDocument {
  const s = shell("graph", partial);
  return { ...s, type: "graph", nodes, edges };
}

export function createAnnotationLayer(
  partial?: Partial<LayerShell>,
  features: AnnotationLayerDocument["features"] = [],
): AnnotationLayerDocument {
  const s = shell("annotations", partial);
  return { ...s, type: "annotations", features };
}

export function createSensorLayer(
  partial?: Partial<LayerShell>,
  features: SensorLayerDocument["features"] = [],
): SensorLayerDocument {
  const s = shell("sensors", partial);
  return { ...s, type: "sensors", features };
}
