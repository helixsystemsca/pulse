import { departmentWorkspaceAllowed } from "@/lib/access-snapshot";
import type { PulseAuthSession } from "@/lib/pulse-session";

/** True when the signed-in user may open `/{departmentSlug}/…` department workspace routes. */
export function userMayAccessDepartmentWorkspace(
  session: PulseAuthSession | null,
  departmentSlug: string,
): boolean {
  return departmentWorkspaceAllowed(session, departmentSlug);
}
