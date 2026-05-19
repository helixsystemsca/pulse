import { apiFetch } from "@/lib/api";
import type { EmployeeDailyAvailabilityEntry } from "@/lib/schedule/employee-availability-types";

type ApiRow = {
  id: string;
  employee_id: string;
  date: string;
  status: string;
  start_time?: string | null;
  end_time?: string | null;
  restriction_type?: string | null;
  notes?: string | null;
  source?: string;
};

function mapRow(r: ApiRow): EmployeeDailyAvailabilityEntry {
  return {
    id: r.id,
    employeeId: r.employee_id,
    date: r.date,
    status: r.status as EmployeeDailyAvailabilityEntry["status"],
    startTime: r.start_time ?? null,
    endTime: r.end_time ?? null,
    restrictionType: (r.restriction_type as EmployeeDailyAvailabilityEntry["restrictionType"]) ?? null,
    notes: r.notes ?? null,
    source: r.source,
  };
}

export function buildEmployeeAvailabilityIndex(
  rows: EmployeeDailyAvailabilityEntry[],
): Record<string, EmployeeDailyAvailabilityEntry[]> {
  const out: Record<string, EmployeeDailyAvailabilityEntry[]> = {};
  for (const row of rows) {
    const key = `${row.employeeId}|${row.date}`;
    if (!out[key]) out[key] = [];
    out[key].push(row);
  }
  return out;
}

export async function fetchEmployeeAvailability(
  from: string,
  to: string,
  employeeId?: string,
): Promise<EmployeeDailyAvailabilityEntry[]> {
  const sp = new URLSearchParams({ from, to });
  if (employeeId) sp.set("employee_id", employeeId);
  const rows = await apiFetch<ApiRow[]>(`/api/v1/pulse/schedule/employee-availability?${sp}`);
  return rows.map(mapRow);
}

export type SeedJuneAvailabilityResult = {
  employees_matched: number;
  employees_missing: string[];
  entries_created: number;
  entries_skipped_duplicates: number;
  wiped_rows: number;
  execution_ms: number;
};

export async function seedJuneAuxiliaryAvailabilityDev(): Promise<SeedJuneAvailabilityResult> {
  return apiFetch<SeedJuneAvailabilityResult>(
    "/api/v1/pulse/schedule/employee-availability/dev/seed-june-2026-aux",
    { method: "POST" },
  );
}
