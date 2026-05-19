import { normalizeScheduleDepartmentSlug } from "@/lib/schedule/schedule-department";
import type { PulseAuthSession } from "@/lib/pulse-session";

/** Default inventory partition from HR profile (e.g. communications for Lisa). */
export function defaultInventoryDepartmentFromSession(
  session: Pick<PulseAuthSession, "hr_department"> | null | undefined,
): string {
  return normalizeScheduleDepartmentSlug(session?.hr_department) ?? "maintenance";
}

/** Departments that hide the contractors tab (maintenance-only workflow). */
export const INVENTORY_CONTRACTORS_EXCLUDED_DEPARTMENTS = new Set(["communications"]);

export function inventoryShowsContractorsTab(departmentSlug: string): boolean {
  const slug = (departmentSlug || "maintenance").trim().toLowerCase();
  return !INVENTORY_CONTRACTORS_EXCLUDED_DEPARTMENTS.has(slug);
}
