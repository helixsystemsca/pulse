import type { Shift } from "@/lib/schedule/types";

/** Merge explicit API badges with event-type defaults (metadata layer). */
export function deriveOperationalBadges(shift: Shift): string[] {
  const codes = [...(shift.operationalBadges ?? [])];
  if (shift.eventType === "training") codes.push("TRN");
  if (shift.eventType === "vacation") codes.push("PTO");
  if (shift.eventType === "sick") codes.push("SICK");
  return [...new Set(codes.map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
}
