/**
 * Canonical spatial geometry — wall-coordinate inches, normalized for persistence.
 * Konva is render-only; never persist Stage node JSON.
 */

export type PlannerToolMode = "select" | "inventory" | "constraint" | "pan";

export type ConstraintType =
  | "blocked"
  | "mountable"
  | "restricted"
  | "premium_visibility"
  | "curved_surface"
  | "electrical_access";

/** Future: bezier paths, mesh regions */
export type GeometryPrimitiveType = "polygon";

/** Flat [x, y, x, y, …] in wall inches (origin top-left). */
export type PolygonPointsInches = readonly number[];

export type AnchorPoint = {
  index: number;
  x: number;
  y: number;
};

export type ConstraintRegion = {
  id: string;
  type: GeometryPrimitiveType;
  constraintType: ConstraintType;
  points: PolygonPointsInches;
  label?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type GeometryLayerId = "backdrop" | "constraints" | "inventory" | "annotations" | "interaction";

export type GeometryLayer = {
  id: GeometryLayerId;
  visible: boolean;
  locked?: boolean;
};

/** Future calibration UI — store reference line in wall inches. */
export type CalibrationReference = {
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  realWorldDistanceInches: number;
};

export const DEFAULT_GEOMETRY_LAYERS: readonly GeometryLayer[] = [
  { id: "backdrop", visible: true, locked: true },
  { id: "constraints", visible: true },
  { id: "inventory", visible: true },
  { id: "annotations", visible: true },
  { id: "interaction", visible: true },
] as const;
