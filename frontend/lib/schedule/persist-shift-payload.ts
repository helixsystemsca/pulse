import { formatLocalDate, parseLocalDate } from "@/lib/schedule/calendar";
import { localDateTimeToIso } from "@/lib/schedule/pulse-bridge";
import type { Shift } from "@/lib/schedule/types";

export function shiftWindowToIso(
  date: string,
  startTime: string,
  endTime: string,
): { starts_at: string; ends_at: string } {
  const starts_at = localDateTimeToIso(date, startTime);
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMins = (sh || 0) * 60 + (sm || 0);
  const endMins = (eh || 0) * 60 + (em || 0);
  let endDate = date;
  if (endMins <= startMins) {
    const d = parseLocalDate(date);
    d.setDate(d.getDate() + 1);
    endDate = formatLocalDate(d);
  }
  const ends_at = localDateTimeToIso(endDate, endTime);
  return { starts_at, ends_at };
}

/** JSON body for POST/PATCH `/api/v1/pulse/schedule/shifts`. */
export function buildScheduleShiftPersistPayload(shift: Shift, departmentSlug: string | undefined) {
  const { starts_at, ends_at } = shiftWindowToIso(shift.date, shift.startTime, shift.endTime);
  return {
    assigned_user_id: shift.workerId!,
    starts_at,
    ends_at,
    facility_id: shift.zoneId || null,
    shift_type: shift.shiftType,
    shift_definition_id: shift.shiftDefinitionId || null,
    shift_code: shift.shiftCode || null,
    requires_supervisor: !!shift.requires_supervisor,
    requires_ticketed: false,
    department_slug: departmentSlug,
  };
}
