import { extentSize } from "@/spatial-engine/document/extent";
import { getDocumentLayer } from "@/spatial-engine/document/query";
import type { ConstraintFeatureDocument, InventoryItemDocument } from "@/spatial-engine/document/layers/types";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import { rectIntersectsPolygon } from "@/spatial-engine/geometry/collision";
import { rectsOverlap } from "@/spatial-engine/geometry/polygon";
import type {
  CollisionEngineOptions,
  CollisionViolation,
  CollisionViolationKind,
  DocumentConstraintSeverity,
  InventoryPlacementRect,
  PlacementValidationResult,
} from "@/spatial-engine/intelligence/collision/types";
import type { WorldRect } from "@/spatial-engine/types/spatial";

function inventoryRect(item: InventoryItemDocument): WorldRect {
  const g = item.geometry;
  return { x: g.x, y: g.y, width: g.width, height: g.height };
}

function constraintSeverity(feature: ConstraintFeatureDocument): DocumentConstraintSeverity {
  const raw = feature.metadata.constraintType;
  if (typeof raw !== "string") return "blocked";
  const normalized = raw.toLowerCase();
  if (
    normalized === "blocked" ||
    normalized === "restricted" ||
    normalized === "clearance" ||
    normalized === "preferred" ||
    normalized === "info"
  ) {
    return normalized;
  }
  return "blocked";
}

function violationForConstraint(
  severity: DocumentConstraintSeverity,
  constraintId: string,
  inventoryId: string | undefined,
  treatRestrictedAsWarning: boolean,
): CollisionViolation | null {
  let kind: CollisionViolationKind;
  let level: CollisionViolation["severity"];
  let message: string;

  switch (severity) {
    case "blocked":
      kind = "constraint_blocked";
      level = "error";
      message = "Placement overlaps a blocked region.";
      break;
    case "restricted":
      kind = "constraint_restricted";
      level = treatRestrictedAsWarning ? "warning" : "error";
      message = "Placement overlaps a restricted region.";
      break;
    case "clearance":
      kind = "constraint_clearance";
      level = "warning";
      message = "Placement overlaps a clearance zone.";
      break;
    case "preferred":
    case "info":
      return null;
    default:
      kind = "constraint_blocked";
      level = "error";
      message = "Placement overlaps a constraint.";
  }

  return { kind, severity: level, message, constraintId, inventoryId };
}

function rectOutOfBounds(rect: WorldRect, bounds: { width: number; height: number }): boolean {
  if (rect.width <= 0 || rect.height <= 0) return true;
  if (rect.x < 0 || rect.y < 0) return true;
  if (rect.x + rect.width > bounds.width) return true;
  if (rect.y + rect.height > bounds.height) return true;
  return false;
}

/** Validate a single inventory rect against document layers (deterministic, canonical geometry). */
export function validateInventoryPlacement(
  doc: SpatialDocument,
  rect: InventoryPlacementRect,
  options: CollisionEngineOptions = {},
): PlacementValidationResult {
  const violations: CollisionViolation[] = [];
  const { width, height } = extentSize(doc.coordinateSpace.extent);

  if (rectOutOfBounds(rect, { width, height })) {
    violations.push({
      kind: "out_of_bounds",
      severity: "error",
      message: "Placement is outside the workspace bounds.",
      inventoryId: rect.id,
    });
  }

  const constraints = getDocumentLayer(doc, "constraints")?.features ?? [];
  for (const feature of constraints) {
    if (feature.geometry.kind !== "polygon") continue;
    if (!rectIntersectsPolygon(rect, feature.geometry.points)) continue;
    const v = violationForConstraint(
      constraintSeverity(feature),
      feature.id,
      rect.id,
      options.treatRestrictedAsWarning ?? true,
    );
    if (v) violations.push(v);
  }

  if (options.checkInventoryOverlap !== false) {
    const inventory = getDocumentLayer(doc, "inventory")?.items ?? [];
    for (const item of inventory) {
      if (options.excludeInventoryId && item.id === options.excludeInventoryId) continue;
      if (rect.id && item.id === rect.id) continue;
      const other = inventoryRect(item);
      if (rectsOverlap(rect.x, rect.y, rect.width, rect.height, other.x, other.y, other.width, other.height)) {
        violations.push({
          kind: "inventory_overlap",
          severity: "error",
          message: "Placement overlaps another inventory item.",
          inventoryId: rect.id,
          otherInventoryId: item.id,
        });
      }
    }
  }

  const hasError = violations.some((v) => v.severity === "error");
  return { valid: !hasError, violations };
}

/** Evaluate all inventory items on a document. */
export function evaluateDocumentCollisions(
  doc: SpatialDocument,
  options: CollisionEngineOptions = {},
): Map<string, PlacementValidationResult> {
  const inventory = getDocumentLayer(doc, "inventory")?.items ?? [];
  const results = new Map<string, PlacementValidationResult>();

  for (const item of inventory) {
    const rect = { ...inventoryRect(item), id: item.id };
    results.set(
      item.id,
      validateInventoryPlacement(doc, rect, {
        ...options,
        excludeInventoryId: item.id,
      }),
    );
  }

  return results;
}

/** First error violation for a placement, if any. */
export function placementBlocked(
  doc: SpatialDocument,
  rect: InventoryPlacementRect,
  options?: CollisionEngineOptions,
): boolean {
  return !validateInventoryPlacement(doc, rect, options).valid;
}
