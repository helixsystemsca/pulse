import type { PulseAuthSession } from "@/lib/pulse-session";
import { isPlatformDepartmentSlug } from "@/config/platform/departments";
import { listDepartmentsAllowedForSession } from "@/config/platform/navigation";

/** True when the signed-in user may open `/{departmentSlug}/…` workspace routes. */
export function userMayAccessDepartmentWorkspace(
  session: PulseAuthSession | null,
  departmentSlug: string,
): boolean {
  if (!session || !departmentSlug) return false;
  if (!isPlatformDepartmentSlug(departmentSlug)) return false;
  if (session.is_system_admin || session.role === "system_admin") return true;
  return listDepartmentsAllowedForSession(session).some((d) => d.slug === departmentSlug);
}
