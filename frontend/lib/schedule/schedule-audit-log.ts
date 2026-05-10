/**
 * Client-side audit stub for availability overrides.
 * Replace with POST /api/v1/pulse/schedule/audit-events when backend exists.
 */

export type ScheduleAuditEventType = "availability_override";

export type ScheduleAuditEvent = {
  id: string;
  type: ScheduleAuditEventType;
  at: string;
  actorLabel: string;
  workerId: string;
  date: string;
  reason: string;
};

const memory: ScheduleAuditEvent[] = [];

export function logScheduleAuditEvent(ev: Omit<ScheduleAuditEvent, "id" | "at"> & { at?: string }): ScheduleAuditEvent {
  const row: ScheduleAuditEvent = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}`,
    at: ev.at ?? new Date().toISOString(),
    ...ev,
  };
  memory.unshift(row);
  if (memory.length > 200) memory.pop();
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.info("[schedule-audit]", row);
  }
  return row;
}

export function peekScheduleAuditLog(): ScheduleAuditEvent[] {
  return [...memory];
}
