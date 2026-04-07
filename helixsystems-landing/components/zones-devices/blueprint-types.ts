/**
 * Frontend blueprint element (API uses the same shape; optional fields match OpenAPI).
 * Design-tool mental model: `zone` ≈ room, `path` ≈ closed free-hand shape (free draw), `symbol` = placed icon.
 */
export type BlueprintElement = {
  id: string;
  type: "zone" | "device" | "door" | "path" | "symbol";
  x: number;
  y: number;
  width?: number;
  height?: number;
  name?: string;
  rotation?: number;
  linked_device_id?: string;
  assigned_zone_id?: string;
  device_kind?: string;
  /** Door on zone wall: "{zoneElementId}:{edge0-3}:{t01}" */
  wall_attachment?: string;
  /** Flat x,y pairs (world), closed polygon without repeating first vertex */
  path_points?: number[];
  /** Symbol discriminator (extensible; built-ins listed in SYMBOL_LIBRARY) */
  symbol_type?: string;
  symbol_tags?: string[];
  symbol_notes?: string;
};

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
  | "place-device"
  | "place-door"
  | "free-draw"
  | "place-symbol";
