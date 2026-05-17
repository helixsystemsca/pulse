import type { ComponentType, ReactNode } from "react";
import type { SpatialLayerId } from "@/spatial-engine/layers/types";
import type { SpatialToolHotkey } from "@/spatial-engine/tools/types";

export type SpatialWorkspaceId = "advertising" | "infrastructure";

export type SpatialWorkspaceToolGroup = "navigation" | "primary" | "utility";

export type SpatialWorkspaceToolEntry = {
  id: string;
  label: string;
  group: SpatialWorkspaceToolGroup;
  icon: ComponentType<{ className?: string }>;
  hotkeys?: SpatialToolHotkey[];
  layerTargets?: SpatialLayerId[];
  cursor?: string;
  disabled?: boolean;
  disabledReason?: string;
};

export type SpatialWorkspaceLayerEntry = {
  id: SpatialLayerId;
  label: string;
  zIndex: number;
  defaultVisible: boolean;
  interactive?: boolean;
};

export type SpatialWorkspaceSidePanel = "left" | "right";

export type SpatialWorkspaceDefinition = {
  id: SpatialWorkspaceId;
  label: string;
  description?: string;
  tools: readonly SpatialWorkspaceToolEntry[];
  layers: readonly SpatialWorkspaceLayerEntry[];
  sidePanels: readonly SpatialWorkspaceSidePanel[];
  /** RBAC permission keys — checked by host app when wiring workspace. */
  permissions?: readonly string[];
};

export type SpatialWorkspaceShellSlots = {
  headerActions?: ReactNode;
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  viewport: ReactNode;
  floatingControls?: ReactNode;
  minimap?: ReactNode;
  statusHint?: ReactNode;
  banner?: ReactNode;
};
