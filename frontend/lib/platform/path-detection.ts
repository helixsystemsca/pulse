import { PLATFORM_DEPARTMENT_SLUGS } from "@/config/platform/departments";

/** True when the first URL segment is a configured department workspace slug. */
export function isPlatformDepartmentPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const first = pathname.split("/").filter(Boolean)[0];
  return PLATFORM_DEPARTMENT_SLUGS.includes(first);
}
