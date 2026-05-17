/**
 * Conceptual layer contracts — rendering behavior stays in each domain.
 */

export type SpatialLayerId =
  | "backdrop"
  | "geometry"
  | "constraints"
  | "inventory"
  | "graph"
  | "annotations"
  | "interaction";

export interface SpatialLayerState {
  id: SpatialLayerId;
  visible: boolean;
  locked?: boolean;
  opacity?: number;
}

export interface BackdropLayerContract extends SpatialLayerState {
  id: "backdrop";
}

export interface GeometryLayerContract extends SpatialLayerState {
  id: "geometry";
}

export interface ConstraintLayerContract extends SpatialLayerState {
  id: "constraints";
}

export interface InventoryLayerContract extends SpatialLayerState {
  id: "inventory";
}

export interface GraphLayerContract extends SpatialLayerState {
  id: "graph";
}

export interface AnnotationLayerContract extends SpatialLayerState {
  id: "annotations";
}

export interface InteractionOverlayLayerContract extends SpatialLayerState {
  id: "interaction";
}

export type SpatialLayerContract =
  | BackdropLayerContract
  | GeometryLayerContract
  | ConstraintLayerContract
  | InventoryLayerContract
  | GraphLayerContract
  | AnnotationLayerContract
  | InteractionOverlayLayerContract;

export const DEFAULT_SPATIAL_LAYERS: readonly SpatialLayerContract[] = [
  { id: "backdrop", visible: true, locked: true },
  { id: "geometry", visible: true },
  { id: "constraints", visible: true },
  { id: "inventory", visible: true },
  { id: "graph", visible: true },
  { id: "annotations", visible: true },
  { id: "interaction", visible: true },
] as const;
