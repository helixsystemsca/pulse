import { apiFetch, isApiMode } from "@/lib/api";
import { formatLocalDate, parseLocalDate } from "@/lib/schedule/calendar";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  isPulseApiShiftId,
  localDateTimeToIso,
  type PulseShiftApi,
} from "@/lib/schedule/pulse-bridge";
import type { Shift } from "@/lib/schedule/types";

type ShiftCreateResult = { shift: PulseShiftApi };

function shiftWindowToIso(
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

function shiftPayload(shift: Shift, departmentSlug: string | undefined) {
  const { starts_at, ends_at } = shiftWindowToIso(shift.date, shift.startTime, shift.endTime);
  return {
    assigned_user_id: shift.workerId!,
    starts_at,
    ends_at,
    facility_id: shift.zoneId || null,
    shift_type: shift.shiftType,
    requires_supervisor: !!shift.requires_supervisor,
    requires_ticketed: false,
    department_slug: departmentSlug,
  };
}

export type EnsureShiftOnServerResult = { id: string } | { error: string };

/**
 * Create or update a workforce shift on the Pulse API so routine assignment and work-queue calls succeed.
 * Materializes recurring-template (ephemeral) rows when the schedule is published.
 */
export async function persistScheduleShiftToServer(
  shift: Shift,
  departmentSlug: string | undefined,
): Promise<string | null> {
  if (!isApiMode()) return null;
  if (!shift.workerId || shift.eventType !== "work" || shift.shiftKind === "project_task") return null;

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
  } catch (e) {
    const { message } = parseClientApiError(e);
    throw new Error(message || "Could not register shift on the server.");
  }
}

/** Wraps {@link persistScheduleShiftToServer} for routine assignment (published schedule). */
export async function ensureShiftOnServerForAssignment(
  shift: Shift,
  departmentSlug: string | undefined,
  reload: () => Promise<void>,
): Promise<EnsureShiftOnServerResult> {
  try {
    const id = await persistScheduleShiftToServer(shift, departmentSlug);
    if (!id) {
      return { error: "This shift cannot be registered for routine assignment." };
    }
    await reload();
    return { id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not register shift on the server." };
  }
}
