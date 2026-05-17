import type { CalibrationReference } from "@/spatial-engine/coordinates/calibrated-space";
import type { CoordinateSpaceKind } from "@/spatial-engine/coordinates/types";
import type { SpatialDocumentLayer } from "@/spatial-engine/document/layers/types";
import type { WorldBounds } from "@/spatial-engine/types/spatial";

/** Schema version for serialized spatial documents. */
export const SPATIAL_DOCUMENT_VERSION = 1;

export type SpatialWorkspaceKind = "advertising" | "infrastructure";

export type SpatialCoordinateSpace = {
  kind: CoordinateSpaceKind;
  /** Display unit for linear measurements (e.g. `in`, `px`). */
  linearUnit: string;
  extent: WorldBounds;
  /** Screen pixels per world unit at viewport scale 1 (inch/calibrated workspaces). */
  basePixelsPerUnit?: number;
};

export type SpatialBackdropKind = "none" | "image" | "solid";

export type SpatialBackdrop = {
  kind: SpatialBackdropKind;
  url?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  /** Domain variant tag (arena wall, floor plan, aerial, …). */
  variant?: string;
  /** Solid fill when kind is `solid`. */
  fill?: string;
};

export type SpatialCalibrationStatus = "none" | "draft" | "applied";

/**
 * Document-level calibration — two known points map image/world space to real distance.
 * Future-ready for inch/pixel scaling UI.
 */
export type SpatialCalibration = {
  status: SpatialCalibrationStatus;
  reference: CalibrationReference;
  /** Unit of `reference.realWorldDistance`. */
  distanceUnit: "in" | "ft" | "m" | "px";
  appliedAt?: string;
  notes?: string;
};

export type SpatialDocumentMetadata = {
  title?: string;
  workspaceId?: SpatialWorkspaceKind;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Opaque domain fields (project id, map category, …) — JSON-serializable only. */
  domain?: Record<string, unknown>;
};

/**
 * Canonical spatial document — geometry + layer metadata only.
 * Never includes Konva stage state or raw node JSON.
 */
export type SpatialDocument = {
  id: string;
  version: typeof SPATIAL_DOCUMENT_VERSION;
  coordinateSpace: SpatialCoordinateSpace;
  backdrop: SpatialBackdrop;
  calibration: SpatialCalibration | null;
  layers: SpatialDocumentLayer[];
  metadata: SpatialDocumentMetadata;
};
