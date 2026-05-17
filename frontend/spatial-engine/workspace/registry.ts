import type { SpatialWorkspaceDefinition, SpatialWorkspaceId } from "@/spatial-engine/workspace/types";
import { ADVERTISING_WORKSPACE } from "@/spatial-engine/workspace/definitions/advertising";
import { INFRASTRUCTURE_WORKSPACE } from "@/spatial-engine/workspace/definitions/infrastructure";

const WORKSPACES: Record<SpatialWorkspaceId, SpatialWorkspaceDefinition> = {
  advertising: ADVERTISING_WORKSPACE,
  infrastructure: INFRASTRUCTURE_WORKSPACE,
};

export function getSpatialWorkspace(id: SpatialWorkspaceId): SpatialWorkspaceDefinition {
  return WORKSPACES[id];
}

export function listSpatialWorkspaces(): SpatialWorkspaceDefinition[] {
  return Object.values(WORKSPACES);
}

export function getWorkspaceTool(id: SpatialWorkspaceId, toolId: string) {
  return getSpatialWorkspace(id).tools.find((t) => t.id === toolId);
}

export function orderedWorkspaceLayers(id: SpatialWorkspaceId) {
  return [...getSpatialWorkspace(id).layers].sort((a, b) => a.zIndex - b.zIndex);
}
