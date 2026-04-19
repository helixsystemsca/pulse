/**
 * Mirrors `OperationalDashboard` `buildLiveModel` workforce bubble rules:
 * - On-site: assigned shift overlaps "now" (local calendar day for listing, server-aligned instant for active check).
 * - Scheduled (off shift): shift today but none active.
 * - Unscheduled today: no shifts today.
 */
import { apiFetch } from "@/lib/api/client";
import { getServerAlignedNow } from "@/lib/serverTime";

export type PulseShiftOut = {
  id: string;
  assigned_user_id: string;
  zone_id: string | null;
  starts_at: string;
  ends_at: string;
};

export type PulseZoneOut = { id: string; name: string };

export type MyShiftPresence = {
  primaryLabel: string;
  detailLine: string;
  dot: "on_shift" | "scheduled_off" | "unscheduled" | "unknown";
};

function localCalendarDayBoundsIso(nowMs: number): { from: string; to: string } {
  const anchor = new Date(nowMs);
  const dayStart = new Date(anchor);
  dayStart.setHours(0, 0, 0, 0);
  const dayEndExclusive = new Date(dayStart);
  dayEndExclusive.setDate(dayEndExclusive.getDate() + 1);
  return { from: dayStart.toISOString(), to: dayEndExclusive.toISOString() };
}

export async function fetchPulseZones(token: string): Promise<PulseZoneOut[]> {
  return apiFetch<PulseZoneOut[]>("/api/v1/pulse/zones", { token });
}

export async function fetchPulseShiftsForLocalCalendarDay(token: string, nowMs: number): Promise<PulseShiftOut[]> {
  const { from, to } = localCalendarDayBoundsIso(nowMs);
  const q = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return apiFetch<PulseShiftOut[]>(`/api/v1/pulse/schedule/shifts?${q}`, { token });
}

export function computeMyShiftPresence(
  userId: string,
  shifts: PulseShiftOut[],
  zones: PulseZoneOut[],
  nowMs: number,
): MyShiftPresence {
  const zoneName = (id: string | null) => (id ? zones.find((z) => z.id === id)?.name ?? "Unknown zone" : "Unassigned");

  const anchor = new Date(nowMs);
  const dayStart = new Date(anchor);
  dayStart.setHours(0, 0, 0, 0);
  const dayEndExclusive = new Date(dayStart);
  dayEndExclusive.setDate(dayEndExclusive.getDate() + 1);
  const dayStartMs = dayStart.getTime();
  const dayEndMsExclusive = dayEndExclusive.getTime();

  const shiftsToday = shifts.filter((s) => {
    const a = new Date(s.starts_at).getTime();
    const b = new Date(s.ends_at).getTime();
    return a < dayEndMsExclusive && b > dayStartMs;
  });

  const mine = shiftsToday.filter((s) => s.assigned_user_id === userId);
  const activeShift = mine.find((s) => {
    const a = new Date(s.starts_at).getTime();
    const b = new Date(s.ends_at).getTime();
    return a <= nowMs && nowMs < b;
  });
  const scheduledToday = mine.length > 0;

  if (activeShift) {
    return {
      primaryLabel: "On-site",
      detailLine: zoneName(activeShift.zone_id),
      dot: "on_shift",
    };
  }
  if (scheduledToday) {
    return {
      primaryLabel: "Scheduled (off shift)",
      detailLine: "Not on shift now",
      dot: "scheduled_off",
    };
  }
  return {
    primaryLabel: "Unscheduled today",
    detailLine: "",
    dot: "unscheduled",
  };
}

/** Load zones + shifts and compute presence for the signed-in user (server-aligned clock). */
export async function loadMyShiftPresence(token: string, userId: string): Promise<MyShiftPresence> {
  const nowMs = getServerAlignedNow();
  try {
    const [zones, shifts] = await Promise.all([
      fetchPulseZones(token),
      fetchPulseShiftsForLocalCalendarDay(token, nowMs),
    ]);
    return computeMyShiftPresence(userId, shifts, zones, nowMs);
  } catch {
    return {
      primaryLabel: "Schedule unavailable",
      detailLine: "",
      dot: "unknown",
    };
  }
}
