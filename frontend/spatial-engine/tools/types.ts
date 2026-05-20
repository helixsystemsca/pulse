import type { SpatialLayerId } from "@/spatial-engine/layers/types";

export type SpatialInteractionKind =
  | "pointer-down"
  | "pointer-move"
  | "pointer-up"
  | "click"
  | "double-click"
  | "drag"
  | "wheel"
  | "keydown";

export type SpatialToolInteraction = {
  kind: SpatialInteractionKind;
  /** When true, tool owns the event and lower layers should not handle it. */
  capture?: boolean;
};

export type SpatialToolHotkey = {
  key: string;
  modifiers?: ("ctrl" | "shift" | "alt" | "meta")[];
  description?: string;
};

/**
 * Registry entry for a spatial editing tool.
 * Domains register tools; the engine does not implement domain tools yet.
 */
export type SpatialToolDefinition = {
  id: string;
  label?: string;
  cursor?: string;
  interactions: SpatialToolInteraction[];
  hotkeys?: SpatialToolHotkey[];
  /** Layers this tool may read/write. */
  layerTargets: SpatialLayerId[];
  enabled?: boolean;
};

export type SpatialToolRegistry = {
  tools: readonly SpatialToolDefinition[];
  getById(id: string): SpatialToolDefinition | undefined;
};

export function createSpatialToolRegistry(tools: SpatialToolDefinition[]): SpatialToolRegistry {
  const byId = new Map(tools.map((t) => [t.id, t]));
  return {
    tools,
    getById(id: string) {
      return byId.get(id);
    },
  };
}
