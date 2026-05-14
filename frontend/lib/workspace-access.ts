import { buildDepartmentNavItems } from "@/config/platform/navigation";
import { isPlatformDepartmentSlug } from "@/config/platform/departments";
import type { PulseAuthSession } from "@/lib/pulse-session";

/** True when the signed-in user may open `/{departmentSlug}/…` routes (RBAC ∩ contract modules only). */
export function userMayAccessDepartmentWorkspace(
  session: PulseAuthSession | null,
  departmentSlug: string,
): boolean {
  if (!session || !departmentSlug) return false;
  if (!isPlatformDepartmentSlug(departmentSlug)) return false;
  if (session.is_system_admin || session.role === "system_admin") return true;
  return buildDepartmentNavItems(departmentSlug, session).length > 0;
}
