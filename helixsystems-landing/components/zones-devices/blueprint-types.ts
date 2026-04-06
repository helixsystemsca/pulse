/** Frontend blueprint element (API uses the same shape; optional fields match OpenAPI). */
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

/** Undoable document slice: geometry and element metadata only. */
export type BlueprintState = {
  elements: BlueprintElement[];
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
