export { ADVERTISING_WORKSPACE } from "@/spatial-engine/workspace/definitions/advertising";
export { FACILITIES_WORKSPACE } from "@/spatial-engine/workspace/definitions/facilities";
export { INFRASTRUCTURE_WORKSPACE } from "@/spatial-engine/workspace/definitions/infrastructure";
export { SENSORS_WORKSPACE } from "@/spatial-engine/workspace/definitions/sensors";
export {
  canAccessSpatialWorkspace,
  canAccessSpatialWorkspaceDefinition,
  listAccessibleSpatialWorkspaces,
  parseSpatialWorkspaceParam,
  resolveDefaultSpatialWorkspace,
} from "@/spatial-engine/workspace/access";
export { useSpatialWorkspaceTools } from "@/spatial-engine/workspace/hooks/useSpatialWorkspaceTools";
export {
  spatialWorkspaceHref,
  useSpatialWorkspaceAccess,
} from "@/spatial-engine/workspace/hooks/useSpatialWorkspaceAccess";
export {
  defaultLayerVisibility,
  interactiveLayerIds,
  sortedWorkspaceLayers,
  type WorkspaceLayerVisibility,
} from "@/spatial-engine/workspace/layers/workspace-layer-stack";
export {
  getSpatialWorkspace,
  getWorkspaceTool,
  listSpatialWorkspaces,
  orderedWorkspaceLayers,
  registerSpatialWorkspace,
} from "@/spatial-engine/workspace/registry";
export { SpatialToolRail } from "@/spatial-engine/workspace/shell/SpatialToolRail";
export { SpatialViewportControls } from "@/spatial-engine/workspace/shell/SpatialViewportControls";
export { SpatialWorkspaceShell } from "@/spatial-engine/workspace/shell/SpatialWorkspaceShell";
export { SpatialWorkspaceSwitcher } from "@/spatial-engine/workspace/shell/SpatialWorkspaceSwitcher";
export type {
  SpatialWorkspaceAccessGate,
  SpatialWorkspaceDefinition,
  SpatialWorkspaceId,
  SpatialWorkspaceLayerEntry,
  SpatialWorkspaceShellSlots,
  SpatialWorkspaceSidePanel,
  SpatialWorkspaceStatus,
  SpatialWorkspaceToolEntry,
  SpatialWorkspaceToolGroup,
} from "@/spatial-engine/workspace/types";
