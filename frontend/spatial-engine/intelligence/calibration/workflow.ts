import { CalibratedSpaceAdapter } from "@/spatial-engine/coordinates/calibrated-space";
import type { CalibrationReference } from "@/spatial-engine/coordinates/calibrated-space";
import type { SpatialCalibration } from "@/spatial-engine/document/types";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import type {
  AppliedCalibration,
  CalibrationDraft,
  PerspectiveQuad,
} from "@/spatial-engine/intelligence/calibration/types";
import { distance } from "@/spatial-engine/geometry/polygon";
import type { WorldPoint } from "@/spatial-engine/types/spatial";

export function createCalibrationDraft(): CalibrationDraft {
  return {
    step: "idle",
    pointA: null,
    pointB: null,
    realWorldDistance: null,
    distanceUnit: "in",
    perspectiveQuad: null,
  };
}

export function pixelDistanceBetweenPoints(a: WorldPoint, b: WorldPoint): number {
  return Math.max(1e-6, distance(a.x, a.y, b.x, b.y));
}

export function buildCalibrationReference(
  pointA: WorldPoint,
  pointB: WorldPoint,
  realWorldDistance: number,
): CalibrationReference {
  return {
    pointA: { x: pointA.x, y: pointA.y },
    pointB: { x: pointB.x, y: pointB.y },
    realWorldDistance: Math.max(1e-6, realWorldDistance),
  };
}

export function computeAppliedCalibration(
  pointA: WorldPoint,
  pointB: WorldPoint,
  realWorldDistance: number,
  distanceUnit: CalibrationDraft["distanceUnit"],
): AppliedCalibration {
  const reference = buildCalibrationReference(pointA, pointB, realWorldDistance);
  const pixelDistance = pixelDistanceBetweenPoints(pointA, pointB);
  const adapter = CalibratedSpaceAdapter.fromReference(reference, pixelDistance);
  return {
    reference,
    pixelDistance,
    worldUnitsPerPixel: adapter.worldUnitsPerPixel,
    distanceUnit,
    appliedAt: new Date().toISOString(),
  };
}

/** Apply calibration to document coordinate space (deterministic metadata update). */
export function applyCalibrationToDocument(
  doc: SpatialDocument,
  applied: AppliedCalibration,
  notes?: string,
): SpatialDocument {
  const calibration: SpatialCalibration = {
    status: "applied",
    reference: applied.reference,
    distanceUnit: applied.distanceUnit,
    appliedAt: applied.appliedAt,
    notes,
  };

  const basePixelsPerUnit =
    applied.distanceUnit === "px"
      ? 1 / applied.worldUnitsPerPixel
      : 1 / applied.worldUnitsPerPixel;

  return {
    ...doc,
    calibration,
    coordinateSpace: {
      ...doc.coordinateSpace,
      kind: "calibrated",
      basePixelsPerUnit,
    },
    metadata: {
      ...doc.metadata,
      updatedAt: applied.appliedAt,
    },
  };
}

/**
 * Map a point through a bilinear quad correction (foundation for perspective workflows).
 * Normalizes quad corners to axis-aligned unit square then scales to target extent.
 */
export function mapPointThroughPerspectiveQuad(
  point: WorldPoint,
  quad: PerspectiveQuad,
  targetWidth: number,
  targetHeight: number,
): WorldPoint {
  const minX = Math.min(quad.topLeft.x, quad.bottomLeft.x);
  const maxX = Math.max(quad.topRight.x, quad.bottomRight.x);
  const minY = Math.min(quad.topLeft.y, quad.topRight.y);
  const maxY = Math.max(quad.bottomLeft.y, quad.bottomRight.y);
  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);
  const u = (point.x - minX) / w;
  const v = (point.y - minY) / h;
  return {
    x: Math.min(targetWidth, Math.max(0, u * targetWidth)),
    y: Math.min(targetHeight, Math.max(0, v * targetHeight)),
  };
}

export function calibrationDraftCanApply(draft: CalibrationDraft): boolean {
  return (
    draft.pointA !== null &&
    draft.pointB !== null &&
    draft.realWorldDistance !== null &&
    draft.realWorldDistance > 0
  );
}

export function applyCalibrationDraft(doc: SpatialDocument, draft: CalibrationDraft): SpatialDocument | null {
  if (!calibrationDraftCanApply(draft) || !draft.pointA || !draft.pointB || draft.realWorldDistance === null) {
    return null;
  }
  const applied = computeAppliedCalibration(
    draft.pointA,
    draft.pointB,
    draft.realWorldDistance,
    draft.distanceUnit,
  );
  return applyCalibrationToDocument(doc, applied);
}
