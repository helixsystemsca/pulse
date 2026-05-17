import type { SpatialLayerId } from "@/spatial-engine/layers/types";
import type { SpatialWorkspaceLayerEntry } from "@/spatial-engine/workspace/types";

export type WorkspaceLayerVisibility = Record<SpatialLayerId, boolean>;

export function defaultLayerVisibility(layers: readonly SpatialWorkspaceLayerEntry[]): WorkspaceLayerVisibility {
  const out = {} as WorkspaceLayerVisibility;
  for (const layer of layers) {
    out[layer.id] = layer.defaultVisible;
  }
  return out;
}

export function sortedWorkspaceLayers(layers: readonly SpatialWorkspaceLayerEntry[]): SpatialWorkspaceLayerEntry[] {
  return [...layers].sort((a, b) => a.zIndex - b.zIndex);
}

export function interactiveLayerIds(layers: readonly SpatialWorkspaceLayerEntry[]): SpatialLayerId[] {
  return layers.filter((l) => l.interactive).map((l) => l.id);
}
