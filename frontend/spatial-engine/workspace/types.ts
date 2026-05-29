import type { ComponentType, ReactNode } from "react";
import type { SpatialLayerId } from "@/spatial-engine/layers/types";
import type { SpatialToolHotkey } from "@/spatial-engine/tools/types";

export type SpatialWorkspaceId = "advertising" | "infrastructure" | "facilities" | "sensors";

/** RBAC + contract gate — uses existing `/auth/me` snapshot only. */
export type SpatialWorkspaceAccessGate = {
  /** Tenant feature key from master registry (`drawings`, `advertising_mapper`, …). */
  featureKey: string;
  /** Flat RBAC keys; any match grants access (same as sidebar `rbacAnyOf`). */
  rbacAnyOf: readonly string[];
};

export type SpatialWorkspaceStatus = "active" | "coming_soon";

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

/** Workspace chrome — `editor` hides tool rail and uses immersive canvas layout. */
export type SpatialWorkspaceChrome = "default" | "editor";

export type SpatialWorkspaceLayout = {
  chrome?: SpatialWorkspaceChrome;
  /** When true, tools render in `floatingToolbar` slot instead of left rail. */
  hideToolRail?: boolean;
  leftPanelWidthPx?: number;
  rightPanelWidthPx?: number;
};

export type SpatialWorkspaceDefinition = {
  id: SpatialWorkspaceId;
  label: string;
  description?: string;
  status?: SpatialWorkspaceStatus;
  tools: readonly SpatialWorkspaceToolEntry[];
  layers: readonly SpatialWorkspaceLayerEntry[];
  sidePanels: readonly SpatialWorkspaceSidePanel[];
  layout?: SpatialWorkspaceLayout;
  /** Persistence adapter registry key (domain slice). */
  persistenceAdapterKey?: string;
  /** Role-aware access — host must not branch on department slugs. */
  access: SpatialWorkspaceAccessGate;
  /** @deprecated Use `access.rbacAnyOf` */
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
