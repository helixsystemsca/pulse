import { apiFetch, isApiMode } from "@/lib/api";
import { isEphemeralScheduleShiftId } from "@/lib/schedule/recurring";
import {
  isPulseApiShiftId,
  localDateTimeToIso,
  type PulseShiftApi,
} from "@/lib/schedule/pulse-bridge";
import type { Shift } from "@/lib/schedule/types";

type ShiftCreateResult = { shift: PulseShiftApi };

function shiftPayload(shift: Shift, departmentSlug: string | undefined) {
  return {
    assigned_user_id: shift.workerId!,
    starts_at: localDateTimeToIso(shift.date, shift.startTime),
    ends_at: localDateTimeToIso(shift.date, shift.endTime),
    facility_id: shift.zoneId || null,
    shift_type: shift.shiftType,
    requires_supervisor: !!shift.requires_supervisor,
    requires_ticketed: false,
    department_slug: departmentSlug,
  };
}

/**
 * Create or update a workforce shift on the Pulse API so routine assignment and work-queue calls succeed.
 * Returns the server shift id, or null when the shift cannot be persisted.
 */
export async function persistScheduleShiftToServer(
  shift: Shift,
  departmentSlug: string | undefined,
): Promise<string | null> {
  if (!isApiMode()) return null;
  if (!shift.workerId || shift.eventType !== "work" || shift.shiftKind === "project_task") return null;
  if (isEphemeralScheduleShiftId(shift.id)) return null;

  const json = shiftPayload(shift, departmentSlug);

  try {
    if (isPulseApiShiftId(shift.id)) {
      await apiFetch(`/api/v1/pulse/schedule/shifts/${shift.id}`, { method: "PATCH", json });
      return shift.id;
    }
    const result = await apiFetch<ShiftCreateResult>("/api/v1/pulse/schedule/shifts", {
      method: "POST",
      json,
    });
    return result.shift?.id ?? null;
  } catch {
    return null;
  }
}
