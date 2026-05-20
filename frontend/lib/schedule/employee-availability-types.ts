/** Per-day auxiliary availability (API-backed). */

export type EmployeeAvailabilityStatus = "available" | "unavailable" | "conditional" | "open_pickup";

export type EmployeeAvailabilityRestriction =
  | "days_only"
  | "afternoons_only"
  | "nights_only"
  | "gg_only"
  | "day_afternoon_only"
  | "overnight_only";

export type EmployeeDailyAvailabilityEntry = {
  id: string;
  employeeId: string;
  date: string;
  status: EmployeeAvailabilityStatus;
  startTime?: string | null;
  endTime?: string | null;
  restrictionType?: EmployeeAvailabilityRestriction | null;
  notes?: string | null;
  source?: string;
};
