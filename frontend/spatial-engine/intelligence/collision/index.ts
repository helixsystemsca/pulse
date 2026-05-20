export type {
  CollisionEngineOptions,
  CollisionSeverity,
  CollisionViolation,
  CollisionViolationKind,
  DocumentConstraintSeverity,
  InventoryPlacementRect,
  PlacementValidationResult,
} from "@/spatial-engine/intelligence/collision/types";
export {
  evaluateDocumentCollisions,
  placementBlocked,
  validateInventoryPlacement,
} from "@/spatial-engine/intelligence/collision/engine";
