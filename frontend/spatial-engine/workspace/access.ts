import { isUserFeatureEnabled } from "@/lib/features/tenant-features";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { hasRbacPermission, isTenantFullAdminSession } from "@/lib/rbac/session-access";
import type { SpatialWorkspaceDefinition, SpatialWorkspaceId } from "@/spatial-engine/workspace/types";
import { getSpatialWorkspace, listSpatialWorkspaces } from "@/spatial-engine/workspace/registry";

export function canAccessSpatialWorkspace(
  session: PulseAuthSession | null,
  workspaceId: SpatialWorkspaceId,
): boolean {
  const def = getSpatialWorkspace(workspaceId);
  return canAccessSpatialWorkspaceDefinition(session, def);
}

export function canAccessSpatialWorkspaceDefinition(
  session: PulseAuthSession | null,
  def: SpatialWorkspaceDefinition,
): boolean {
  if (!session) return false;
  if (isTenantFullAdminSession(session)) return true;

  const { access } = def;
  if (!isUserFeatureEnabled(session, access.featureKey)) return false;
  if (!access.rbacAnyOf.length) return true;
  return access.rbacAnyOf.some((k) => hasRbacPermission(session, k));
}

export function listAccessibleSpatialWorkspaces(session: PulseAuthSession | null): SpatialWorkspaceDefinition[] {
  return listSpatialWorkspaces().filter((w) => canAccessSpatialWorkspaceDefinition(session, w));
}

export function resolveDefaultSpatialWorkspace(
  session: PulseAuthSession | null,
  preferred?: SpatialWorkspaceId | null,
): SpatialWorkspaceId | null {
  const accessible = listAccessibleSpatialWorkspaces(session);
  if (!accessible.length) return null;
  if (preferred && accessible.some((w) => w.id === preferred)) return preferred;
  const active = accessible.find((w) => w.status !== "coming_soon");
  return active?.id ?? accessible[0]!.id;
}

export function parseSpatialWorkspaceParam(value: string | null | undefined): SpatialWorkspaceId | null {
  if (value === "infrastructure" || value === "advertising" || value === "facilities" || value === "sensors") {
    return value;
  }
  return null;
}
