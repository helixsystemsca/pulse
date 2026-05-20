import type { CalibrationReference } from "@/spatial-engine/coordinates/calibrated-space";
import type { WorldPoint } from "@/spatial-engine/types/spatial";

/** Four image corners in world/pixel space for perspective normalization (foundation). */
export type PerspectiveQuad = {
  topLeft: WorldPoint;
  topRight: WorldPoint;
  bottomRight: WorldPoint;
  bottomLeft: WorldPoint;
};

export type CalibrationWorkflowStep = "idle" | "pick_a" | "pick_b" | "enter_distance" | "review" | "applied";

export type CalibrationDraft = {
  step: CalibrationWorkflowStep;
  pointA: WorldPoint | null;
  pointB: WorldPoint | null;
  realWorldDistance: number | null;
  distanceUnit: "in" | "ft" | "m" | "px";
  perspectiveQuad: PerspectiveQuad | null;
};

export type AppliedCalibration = {
  reference: CalibrationReference;
  pixelDistance: number;
  worldUnitsPerPixel: number;
  distanceUnit: CalibrationDraft["distanceUnit"];
  appliedAt: string;
};
