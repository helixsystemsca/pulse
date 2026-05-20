import type { WorldPoint, WorldRect } from "@/spatial-engine/types/spatial";

export type SnapTargetKind = "grid" | "corner" | "edge" | "vertex" | "constraint_vertex";

export type SnapTarget = {
  kind: SnapTargetKind;
  x: number;
  y: number;
  /** Optional source feature id for debugging/UI. */
  sourceId?: string;
};

export type SmartSnapOptions = {
  gridSize: number;
  gridEnabled: boolean;
  snapThreshold: number;
  /** Prefer snapping X/Y independently to nearest target within threshold. */
  axisSnap?: boolean;
};

export type SnappedPlacement = {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
  target?: SnapTarget;
};

export type ValidPlacementRegion = {
  /** Axis-aligned bounds where rect top-left can be placed without leaving workspace. */
  region: WorldRect;
  /** When false, placement may still violate constraints — use collision engine after snap. */
  withinBounds: boolean;
};
