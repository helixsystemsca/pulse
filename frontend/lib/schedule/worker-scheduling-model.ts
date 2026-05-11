import type { EmploymentType, Worker } from "@/lib/schedule/types";

/**
 * Hybrid scheduling model:
 * - **Structured recurring** — full-time + regular part-time (RPT): recurring templates auto-fill the calendar.
 * - **Flexible deployment** — auxiliary (`part_time`): no recurring generation; assign via drag/drop + palette only.
 */

export function isFlexDeploymentWorker(w: Pick<Worker, "employmentType">): boolean {
  return w.employmentType === "part_time";
}

/** Workers who use recurring template merge (FT + RPT only). */
export function usesStructuredRecurringSchedule(w: Pick<Worker, "employmentType" | "recurringShifts" | "active">): boolean {
  if (!w.active) return false;
  if (isFlexDeploymentWorker(w)) return false;
  return Boolean(w.recurringShifts?.length);
}

/** Map API / legacy employment string to canonical type (already normalized on Worker). */
export function employmentUsesRecurringTemplate(employment: EmploymentType | undefined): boolean {
  return employment === "full_time" || employment === "regular_part_time";
}
