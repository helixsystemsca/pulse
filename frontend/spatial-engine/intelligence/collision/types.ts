import type { WorldRect } from "@/spatial-engine/types/spatial";

/** Canonical constraint severities stored in feature `metadata.constraintType`. */
export type DocumentConstraintSeverity = "blocked" | "restricted" | "clearance" | "preferred" | "info";

export type CollisionViolationKind =
  | "out_of_bounds"
  | "constraint_blocked"
  | "constraint_restricted"
  | "constraint_clearance"
  | "inventory_overlap";

export type CollisionSeverity = "error" | "warning" | "info";

export type CollisionViolation = {
  kind: CollisionViolationKind;
  severity: CollisionSeverity;
  message: string;
  inventoryId?: string;
  constraintId?: string;
  otherInventoryId?: string;
};

export type InventoryPlacementRect = WorldRect & { id?: string };

export type CollisionEngineOptions = {
  /** Inventory id to exclude from overlap checks (e.g. item being dragged). */
  excludeInventoryId?: string;
  /** When true, `restricted` constraints produce warnings instead of errors. */
  treatRestrictedAsWarning?: boolean;
  /** When true, overlapping inventory rects are violations. */
  checkInventoryOverlap?: boolean;
};

export type PlacementValidationResult = {
  valid: boolean;
  violations: CollisionViolation[];
};
