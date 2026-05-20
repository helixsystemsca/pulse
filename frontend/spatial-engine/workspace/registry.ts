import type { SpatialWorkspaceDefinition, SpatialWorkspaceId } from "@/spatial-engine/workspace/types";
import { ADVERTISING_WORKSPACE } from "@/spatial-engine/workspace/definitions/advertising";
import { FACILITIES_WORKSPACE } from "@/spatial-engine/workspace/definitions/facilities";
import { INFRASTRUCTURE_WORKSPACE } from "@/spatial-engine/workspace/definitions/infrastructure";
import { SENSORS_WORKSPACE } from "@/spatial-engine/workspace/definitions/sensors";

const WORKSPACE_ORDER: SpatialWorkspaceId[] = ["infrastructure", "advertising", "facilities", "sensors"];

const WORKSPACES: Record<SpatialWorkspaceId, SpatialWorkspaceDefinition> = {
  advertising: ADVERTISING_WORKSPACE,
  facilities: FACILITIES_WORKSPACE,
  infrastructure: INFRASTRUCTURE_WORKSPACE,
  sensors: SENSORS_WORKSPACE,
};

export function registerSpatialWorkspace(definition: SpatialWorkspaceDefinition): void {
  WORKSPACES[definition.id] = definition;
}

export function getSpatialWorkspace(id: SpatialWorkspaceId): SpatialWorkspaceDefinition {
  return WORKSPACES[id];
}

export function listSpatialWorkspaces(): SpatialWorkspaceDefinition[] {
  return WORKSPACE_ORDER.map((id) => WORKSPACES[id]).filter(Boolean);
}

export function getWorkspaceTool(id: SpatialWorkspaceId, toolId: string) {
  return getSpatialWorkspace(id).tools.find((t) => t.id === toolId);
}

export function orderedWorkspaceLayers(id: SpatialWorkspaceId) {
  return [...getSpatialWorkspace(id).layers].sort((a, b) => a.zIndex - b.zIndex);
}
