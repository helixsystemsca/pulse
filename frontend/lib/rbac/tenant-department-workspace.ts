import type { MasterFeatureDef } from "@/config/platform/master-feature-registry";
import type { PulseAuthSession } from "@/lib/pulse-session";

/** Department slugs that are tenant-configured (not universal operations). */
const TENANT_SCOPED_DEPARTMENT_SLUGS = new Set([
  "communications",
  "aquatics",
  "reception",
  "fitness",
  "racquets",
  "admin",
]);

/** Configured workspace departments for the signed-in tenant (`/auth/me`). */
export function readTenantDepartmentWorkspaceSlugs(session: PulseAuthSession | null): readonly string[] {
  if (!session?.department_workspace_slugs?.length) return [];
  return session.department_workspace_slugs
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isTenantScopedDepartmentSlug(slug: string): boolean {
  return TENANT_SCOPED_DEPARTMENT_SLUGS.has(slug.trim().toLowerCase());
}

export function masterFeatureDepartmentSlug(feature: Pick<MasterFeatureDef, "key" | "ownershipDepartment" | "platformDepartmentSlug">): string | null {
  const platform = feature.platformDepartmentSlug?.trim().toLowerCase();
  if (platform) return platform;
  const owner = feature.ownershipDepartment?.trim().toLowerCase();
  if (owner) return owner;
  const match = /^dashboard_dept_([a-z_]+)$/.exec(feature.key);
  return match?.[1] ?? null;
}

/** True when the module belongs to a department configured for this tenant. */
export function passesTenantDepartmentWorkspaceGate(
  session: PulseAuthSession,
  feature: Pick<MasterFeatureDef, "key" | "ownershipDepartment" | "platformDepartmentSlug">,
): boolean {
  const slug = masterFeatureDepartmentSlug(feature);
  if (!slug || !isTenantScopedDepartmentSlug(slug)) return true;
  const configured = readTenantDepartmentWorkspaceSlugs(session);
  if (!configured.length) return false;
  return configured.includes(slug);
}

export function isDepartmentRouteInTenantWorkspace(session: PulseAuthSession | null, departmentSlug: string): boolean {
  if (!session) return false;
  const slug = departmentSlug.trim().toLowerCase();
  if (!isTenantScopedDepartmentSlug(slug)) return true;
  const configured = readTenantDepartmentWorkspaceSlugs(session);
  if (!configured.length) return false;
  return configured.includes(slug);
}
