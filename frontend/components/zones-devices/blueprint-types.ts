/**
 * Frontend blueprint element (API uses the same shape; optional fields match OpenAPI).
 * Design-tool mental model: `zone` ≈ room, `path` ≈ closed free-hand shape (free draw), `symbol` = placed icon.
 */
export type ConnectionStyle = "electrical" | "plumbing";

/** Named stack entry; list order is top-first (index 0 draws on top). */
export type BlueprintLayer = {
  id: string;
  name: string;
};

export type BlueprintElement = {
  id: string;
  type: "zone" | "device" | "door" | "path" | "symbol" | "group" | "connection" | "rectangle" | "ellipse" | "polygon";
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Axis-aligned rectangle only; clamped to half the shorter side of width×height. */
  cornerRadius?: number;
  name?: string;
  metadata?: {
    isRoom?: boolean;
    name?: string;
    /** Client hint for open annotation strokes; prefer `symbol_type === "map_pen"` for persistence. */
    annotate_open_stroke?: boolean;
  };
  rotation?: number;
  locked?: boolean;
  /** Child element ids when `type === "group"` (order preserved). */
  children?: string[];
  linked_device_id?: string;
  assigned_zone_id?: string;
  device_kind?: string;
  /** Door on zone wall: "{zoneElementId}:{edge0-3}:{t01}" */
  wall_attachment?: string;
  /** Flat x,y pairs: closed polygon for `path` / zone outline; open orthogonal polyline for `connection`. */
  path_points?: number[];
  connection_from?: string;
  connection_to?: string;
  connection_style?: ConnectionStyle;
  /** Symbol discriminator (extensible; built-ins listed in SYMBOL_LIBRARY) */
  symbol_type?: string;
  symbol_tags?: string[];
  symbol_notes?: string;
  /** Which {@link BlueprintLayer} this element paints in (omit = bottom layer when layers exist). */
  layer_id?: string;
};

export function isRoom(el: BlueprintElement): boolean {
  return el.type === "zone" || el.metadata?.isRoom === true;
}

/** Instruction overlay linked to canvas elements (maintenance / SOP-style). */
export type TaskOverlay = {
  id: string;
  title: string;
  mode: "steps" | "paragraph";
  /** `paragraph`: single string; `steps`: ordered lines */
  content: string | string[];
  linked_element_ids: string[];
};

/** Undoable document slice: geometry, element metadata, and task overlays. */
export type BlueprintState = {
  elements: BlueprintElement[];
  tasks: TaskOverlay[];
  /** Top-first paint stack; empty means legacy single-stack ordering until first save. */
  layers: BlueprintLayer[];
};

/**
 * Logical history model (present is also held in React state).
 * Only {@link BlueprintState} snapshots belong here — never UI state.
 */
export type BlueprintHistoryState = {
  past: BlueprintState[];
  present: BlueprintState;
  future: BlueprintState[];
};

/** Blueprint designer primary interaction modes (toolbar). */
export type BlueprintDesignerTool =
  | "select"
  | "draw-room"
  | "draw-rectangle"
  | "draw-ellipse"
  | "draw-polygon"
  | "place-device"
  | "place-door"
  | "free-draw"
  | "draw-pen"
  | "place-symbol";
