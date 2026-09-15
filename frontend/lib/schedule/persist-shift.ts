import { apiFetch, isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { isPulseApiShiftId, type PulseShiftApi } from "@/lib/schedule/pulse-bridge";
import { buildScheduleShiftPersistPayload } from "@/lib/schedule/persist-shift-payload";
import type { Shift } from "@/lib/schedule/types";

export { buildScheduleShiftPersistPayload } from "@/lib/schedule/persist-shift-payload";

type ShiftCreateResult = { shift: PulseShiftApi };

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

  const json = buildScheduleShiftPersistPayload(shift, departmentSlug);

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
