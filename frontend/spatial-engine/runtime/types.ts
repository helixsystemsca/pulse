import type { SpatialDocument } from "@/spatial-engine/document/types";
import type { SpatialSelectionState } from "@/spatial-engine/selection/types";
import type { SpatialViewport } from "@/spatial-engine/types/spatial";
import type { SpatialWorkspaceKind } from "@/spatial-engine/document/types";
import type {
  SpatialOperationalLayerToggles,
  SpatialOperationalOverlay,
} from "@/spatial-engine/operations/types";
import {
  DEFAULT_OPERATIONAL_LAYER_TOGGLES,
} from "@/spatial-engine/operations/types";
import type { SpatialCollaborationBundle } from "@/spatial-engine/operations/collaboration";

/** Transient session state — not serialized with SpatialDocument. */
export type SpatialRuntimeSession = {
  workspaceId: SpatialWorkspaceKind;
  activeDocumentId: string | null;
  selection: SpatialSelectionState;
  viewport: SpatialViewport;
  activeToolId: string;
  /** Opaque tool-local state (draft polygon points, connect-from id, …). */
  toolState: Record<string, unknown>;
  /** Live operational overlays (WO, telemetry, inspections, …) — Phase 7. */
  operationalOverlays: SpatialOperationalOverlay[];
  operationalLayerToggles: SpatialOperationalLayerToggles;
  /** Per-overlay visibility overrides. */
  overlayVisibility: Record<string, boolean>;
  /** In-session collaboration bundle (comments, markups) — not persisted until host saves. */
  collaboration: SpatialCollaborationBundle;
};

export const DEFAULT_SPATIAL_VIEWPORT: SpatialViewport = {
  scale: 1,
  panX: 0,
  panY: 0,
};

export type SpatialRuntimeDocumentEntry = {
  document: SpatialDocument;
  /** Monotonic counter for React subscribers when document reference is stable. */
  revision: number;
};

export { DEFAULT_OPERATIONAL_LAYER_TOGGLES };
