export { ADVERTISING_WORKSPACE } from "@/spatial-engine/workspace/definitions/advertising";
export { INFRASTRUCTURE_WORKSPACE } from "@/spatial-engine/workspace/definitions/infrastructure";
export { useSpatialWorkspaceTools } from "@/spatial-engine/workspace/hooks/useSpatialWorkspaceTools";
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
} from "@/spatial-engine/workspace/registry";
export { SpatialToolRail } from "@/spatial-engine/workspace/shell/SpatialToolRail";
export { SpatialViewportControls } from "@/spatial-engine/workspace/shell/SpatialViewportControls";
export { SpatialWorkspaceShell } from "@/spatial-engine/workspace/shell/SpatialWorkspaceShell";
export type {
  SpatialWorkspaceDefinition,
  SpatialWorkspaceId,
  SpatialWorkspaceLayerEntry,
  SpatialWorkspaceShellSlots,
  SpatialWorkspaceSidePanel,
  SpatialWorkspaceToolEntry,
  SpatialWorkspaceToolGroup,
} from "@/spatial-engine/workspace/types";
