import type { PulseAuthSession } from "@/lib/pulse-session";
import { isPlatformDepartmentSlug } from "@/config/platform/departments";

/** True when the signed-in user may open `/{departmentSlug}/…` workspace routes. */
export function userMayAccessDepartmentWorkspace(
  session: PulseAuthSession | null,
  departmentSlug: string,
): boolean {
  if (!session || !departmentSlug) return false;
  if (!isPlatformDepartmentSlug(departmentSlug)) return false;
  if (session.is_system_admin || session.role === "system_admin") return true;
  const allowed = session.department_workspace_slugs;
  if (!allowed || allowed.length === 0) {
    // Legacy sessions before field existed: do not block (same as pre-guard behaviour).
    return true;
  }
  return allowed.includes(departmentSlug);
}
