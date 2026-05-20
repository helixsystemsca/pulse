import {
  createAnnotationLayer,
  createConstraintLayer,
  createGraphLayer,
  createInventoryLayer,
} from "@/spatial-engine/document/layers/factory";
import type { SpatialDocument, SpatialCoordinateSpace } from "@/spatial-engine/document/types";
import { SPATIAL_DOCUMENT_VERSION } from "@/spatial-engine/document/types";

export type CreateSpatialDocumentOptions = {
  id: string;
  coordinateSpace: SpatialCoordinateSpace;
  title?: string;
  workspaceId?: SpatialDocument["metadata"]["workspaceId"];
  includeDefaultLayers?: boolean;
};

export function createEmptySpatialDocument(options: CreateSpatialDocumentOptions): SpatialDocument {
  const now = new Date().toISOString();
  const layers = options.includeDefaultLayers !== false
    ? [
        createConstraintLayer({ id: "constraints", visible: true }),
        createInventoryLayer({ id: "inventory", visible: true }),
        createGraphLayer({ id: "graph", visible: true }),
        createAnnotationLayer({ id: "annotations", visible: true }),
      ]
    : [];

  return {
    id: options.id,
    version: SPATIAL_DOCUMENT_VERSION,
    coordinateSpace: options.coordinateSpace,
    backdrop: { kind: "none" },
    calibration: null,
    layers,
    metadata: {
      title: options.title,
      workspaceId: options.workspaceId,
      createdAt: now,
      updatedAt: now,
    },
  };
}
