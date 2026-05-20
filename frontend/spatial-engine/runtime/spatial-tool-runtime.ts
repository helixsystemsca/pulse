import type { SpatialDocument } from "@/spatial-engine/document/types";
import {
  addConstraintFeature,
  addInventoryItem,
  patchConstraintFeature,
  patchGraphNode,
  patchInventoryItem,
  removeConstraintFeature,
  removeInventoryItem,
} from "@/spatial-engine/runtime/document-mutations";
import type { ConstraintFeatureDocument, InventoryItemDocument } from "@/spatial-engine/document/layers";

export type SpatialToolId =
  | "select"
  | "pan"
  | "asset"
  | "connect"
  | "zone"
  | "annotate"
  | "inventory"
  | "constraint"
  | "trace";

export type SpatialToolContext = {
  document: SpatialDocument;
  activeToolId: SpatialToolId;
  toolState: Record<string, unknown>;
};

/** Pure document transforms — host store applies results via `updateDocument`. */
export const SpatialToolRuntime = {
  moveGraphNode(doc: SpatialDocument, nodeId: string, x: number, y: number): SpatialDocument {
    return patchGraphNode(doc, nodeId, { position: { x, y } });
  },

  patchInventory(doc: SpatialDocument, itemId: string, patch: Parameters<typeof patchInventoryItem>[2]): SpatialDocument {
    return patchInventoryItem(doc, itemId, patch);
  },

  addInventory(doc: SpatialDocument, item: InventoryItemDocument): SpatialDocument {
    return addInventoryItem(doc, item);
  },

  removeInventory(doc: SpatialDocument, itemId: string): SpatialDocument {
    return removeInventoryItem(doc, itemId);
  },

  addConstraint(doc: SpatialDocument, feature: ConstraintFeatureDocument): SpatialDocument {
    return addConstraintFeature(doc, feature);
  },

  patchConstraint(
    doc: SpatialDocument,
    featureId: string,
    patch: Parameters<typeof patchConstraintFeature>[2],
  ): SpatialDocument {
    return patchConstraintFeature(doc, featureId, patch);
  },

  removeConstraint(doc: SpatialDocument, featureId: string): SpatialDocument {
    return removeConstraintFeature(doc, featureId);
  },
};
