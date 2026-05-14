/**
 * Single import surface for tenant module definitions.
 */
import { MASTER_FEATURES } from "@/config/platform/master-feature-registry";
import { PLATFORM_MODULES } from "@/config/platform/modules";
import type { PlatformModule } from "@/config/platform/types";
import { PLATFORM_WORKSPACE_MODULES } from "@/lib/rbac/platform-workspace-modules";
import type { PlatformWorkspaceModuleDef } from "@/lib/rbac/platform-workspace-modules";

export type { PlatformModule, PlatformWorkspaceModuleDef };
export { MASTER_FEATURES };

export function getPlatformHubModules(): readonly PlatformModule[] {
  return PLATFORM_MODULES;
}

export function getWorkspaceRailModules(): readonly PlatformWorkspaceModuleDef[] {
  return PLATFORM_WORKSPACE_MODULES;
}

export function getMasterProductFeatures() {
  return MASTER_FEATURES;
}
