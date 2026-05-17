import type { AnnotationFeatureDocument, SpatialDocumentLayer } from "@/spatial-engine/document/layers/types";
import {
  isAnnotationLayer,
  isConstraintLayer,
  isGraphLayer,
  isInventoryLayer,
  isSensorLayer,
} from "@/spatial-engine/document/layers/types";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import { SPATIAL_DOCUMENT_VERSION } from "@/spatial-engine/document/types";

export type SerializedSpatialDocument = {
  format: "pulse-spatial-document";
  version: number;
  document: SpatialDocument;
};

const FORMAT = "pulse-spatial-document" as const;

/** JSON-safe payload — canonical geometry only, no Konva/runtime state. */
export function serializeSpatialDocument(doc: SpatialDocument): string {
  const payload: SerializedSpatialDocument = {
    format: FORMAT,
    version: SPATIAL_DOCUMENT_VERSION,
    document: stripRuntimeFields(doc),
  };
  return JSON.stringify(payload, null, 0);
}

export function deserializeSpatialDocument(json: string): SpatialDocument {
  const parsed = JSON.parse(json) as SerializedSpatialDocument | SpatialDocument;

  if ("format" in parsed && parsed.format === FORMAT) {
    return normalizeDocument(parsed.document);
  }

  return normalizeDocument(parsed as SpatialDocument);
}

export function parseSpatialDocumentObject(raw: unknown): SpatialDocument {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid spatial document: expected object");
  }
  const obj = raw as SerializedSpatialDocument | SpatialDocument;
  if ("format" in obj && (obj as SerializedSpatialDocument).format === FORMAT) {
    return normalizeDocument((obj as SerializedSpatialDocument).document);
  }
  return normalizeDocument(obj as SpatialDocument);
}

function stripRuntimeFields(doc: SpatialDocument): SpatialDocument {
  return {
    ...doc,
    layers: doc.layers.map(stripLayerRuntime),
    metadata: { ...doc.metadata, domain: doc.metadata.domain ? { ...doc.metadata.domain } : undefined },
  };
}

function stripLayerRuntime(layer: SpatialDocumentLayer): SpatialDocumentLayer {
  if (isInventoryLayer(layer)) {
    return {
      ...layer,
      items: layer.items.map((item) => ({
        id: item.id,
        geometry: { ...item.geometry },
        metadata: { ...item.metadata },
      })),
    };
  }
  if (isConstraintLayer(layer)) {
    return {
      ...layer,
      features: layer.features.map((f) => ({
        id: f.id,
        geometry: { kind: f.geometry.kind, points: [...f.geometry.points] },
        metadata: { ...f.metadata },
      })),
    };
  }
  if (isGraphLayer(layer)) {
    return {
      ...layer,
      nodes: layer.nodes.map((n) => ({ id: n.id, position: { ...n.position }, metadata: { ...n.metadata } })),
      edges: layer.edges.map((e) => ({ ...e, metadata: { ...e.metadata } })),
    };
  }
  if (isAnnotationLayer(layer)) {
    return {
      ...layer,
      features: layer.features.map((f) => ({
        id: f.id,
        geometry: cloneAnnotationGeometry(f.geometry),
        metadata: { ...f.metadata },
      })),
    };
  }
  if (isSensorLayer(layer)) {
    return {
      ...layer,
      features: layer.features.map((f) => ({
        id: f.id,
        position: { ...f.position },
        sensorType: f.sensorType,
        metadata: { ...f.metadata },
      })),
    };
  }
  return layer;
}

function cloneAnnotationGeometry(g: AnnotationFeatureDocument["geometry"]): AnnotationFeatureDocument["geometry"] {
  switch (g.kind) {
    case "point":
      return { kind: "point", position: { ...g.position } };
    case "rect":
      return { kind: "rect", rect: { ...g.rect } };
    case "polygon":
      return { kind: "polygon", points: [...g.points] };
    case "polyline":
      return { kind: "polyline", points: [...g.points] };
    case "symbol":
      return { kind: "symbol", position: { ...g.position }, symbolType: g.symbolType };
    default: {
      const _x: never = g;
      return _x;
    }
  }
}

function normalizeDocument(doc: SpatialDocument): SpatialDocument {
  if (!doc.id) throw new Error("Spatial document missing id");
  if (!doc.coordinateSpace) throw new Error("Spatial document missing coordinateSpace");
  if (!Array.isArray(doc.layers)) throw new Error("Spatial document missing layers array");

  return {
    ...doc,
    version: SPATIAL_DOCUMENT_VERSION,
    backdrop: doc.backdrop ?? { kind: "none" },
    calibration: doc.calibration ?? null,
    layers: doc.layers.map((l) => ({ ...l })),
    metadata: doc.metadata ?? {},
  };
}
