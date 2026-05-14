/**
 * Single import surface for tenant module definitions used by workspace + platform hubs.
 * Workspace rail entries remain the source for `/{dept}/…` routes; `PLATFORM_MODULES` covers hub metadata.
 */
import { PLATFORM_MODULES } from "@/config/platform/modules";
import type { PlatformModule } from "@/config/platform/types";
import { PLATFORM_WORKSPACE_MODULES } from "@/lib/rbac/platform-workspace-modules";
import type { PlatformWorkspaceModuleDef } from "@/lib/rbac/platform-workspace-modules";

export type { PlatformModule, PlatformWorkspaceModuleDef };

export function getPlatformHubModules(): readonly PlatformModule[] {
  return PLATFORM_MODULES;
}

export function getWorkspaceRailModules(): readonly PlatformWorkspaceModuleDef[] {
  return PLATFORM_WORKSPACE_MODULES;
}
