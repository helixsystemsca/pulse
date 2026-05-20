/**
 * Single-selection model — multi-select is intentionally out of scope for Phase 1.
 */

export type SpatialSelectionKind =
  | "none"
  | "inventory"
  | "polygon"
  | "graph-node"
  | "graph-edge"
  | "annotation";

export type SpatialSelectionState =
  | { kind: "none" }
  | { kind: "inventory"; id: string }
  | { kind: "polygon"; id: string }
  | { kind: "graph-node"; id: string }
  | { kind: "graph-edge"; id: string }
  | { kind: "annotation"; id: string };

export const EMPTY_SPATIAL_SELECTION: SpatialSelectionState = { kind: "none" };

export function isSpatialSelectionEmpty(state: SpatialSelectionState): boolean {
  return state.kind === "none";
}

export function spatialSelectionId(state: SpatialSelectionState): string | null {
  if (state.kind === "none") return null;
  return state.id;
}

export function clearSpatialSelection(): SpatialSelectionState {
  return EMPTY_SPATIAL_SELECTION;
}
