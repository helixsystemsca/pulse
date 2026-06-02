import { normalizeScheduleDepartmentSlug } from "@/lib/schedule/schedule-department";
import type { PulseAuthSession } from "@/lib/pulse-session";

/** Default inventory partition from HR profile (e.g. communications for Lisa). */
export function defaultInventoryDepartmentFromSession(
  session: Pick<PulseAuthSession, "hr_department"> | null | undefined,
): string {
  return normalizeScheduleDepartmentSlug(session?.hr_department) ?? "maintenance";
}

/** Departments that hide the contractors tab when it is enabled (maintenance-only workflow). */
export const INVENTORY_CONTRACTORS_EXCLUDED_DEPARTMENTS = new Set(["communications"]);

/**
 * Whether the inventory page shows the Contractors tab.
 * Temporarily off until a tenant-level setting defines where the directory lives.
 */
const INVENTORY_CONTRACTORS_TAB_ENABLED = false;

export function inventoryShowsContractorsTab(departmentSlug: string): boolean {
  if (!INVENTORY_CONTRACTORS_TAB_ENABLED) return false;
  const slug = (departmentSlug || "maintenance").trim().toLowerCase();
  return !INVENTORY_CONTRACTORS_EXCLUDED_DEPARTMENTS.has(slug);
}
