import type { TimeOffBlock, TimeOffRequestKind, TimeOffRequestStatus } from "@/lib/schedule/types";

const KIND_ALIASES: Record<string, TimeOffRequestKind> = {
  vacation: "vacation",
  sick: "sick",
  personal: "personal",
  training: "training",
  unpaid_leave: "unpaid_leave",
  unpaid: "unpaid_leave",
};

export const TIME_OFF_REQUEST_KINDS: { value: TimeOffRequestKind; label: string }[] = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick" },
  { value: "personal", label: "Personal" },
  { value: "training", label: "Training" },
  { value: "unpaid_leave", label: "Unpaid leave" },
];

export function timeOffKindLabel(kind: TimeOffRequestKind | string | undefined): string {
  return TIME_OFF_REQUEST_KINDS.find((k) => k.value === kind)?.label ?? "Time off";
}

export function timeOffStatusLabel(status: TimeOffRequestStatus): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "denied":
      return "Denied";
    case "needs_review":
      return "Needs review";
    default:
      return "Pending";
  }
}

export function eachDayInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const endD = new Date(`${end}T12:00:00`);
  while (cur <= endD) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function sortIsoDates(dates: string[]): string[] {
  return [...new Set(dates)].sort();
}

export function unionDateRanges(ranges: { start: string; end: string }[]): string[] {
  const set = new Set<string>();
  for (const r of ranges) {
    if (!r.start || !r.end || r.start > r.end) continue;
    for (const d of eachDayInRange(r.start, r.end)) set.add(d);
  }
  return sortIsoDates([...set]);
}

export function boundsFromDates(dates: string[]): { startDate: string; endDate: string } {
  if (!dates.length) {
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: today, endDate: today };
  }
  return { startDate: dates[0]!, endDate: dates[dates.length - 1]! };
}

export function normalizeTimeOffBlock(raw: Partial<TimeOffBlock> & { id: string }): TimeOffBlock {
  const kind = KIND_ALIASES[String(raw.kind ?? "vacation").toLowerCase()] ?? "vacation";
  const status = (raw.status ?? "pending") as TimeOffRequestStatus;
  const dates =
    raw.dates?.length && raw.dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      ? sortIsoDates(raw.dates)
      : raw.startDate && raw.endDate
        ? eachDayInRange(raw.startDate, raw.endDate)
        : [];
  const { startDate, endDate } = boundsFromDates(dates);
  const now = new Date().toISOString();
  return {
    id: raw.id,
    workerId: raw.workerId ?? "",
    startDate,
    endDate,
    dates,
    status: status === "approved" || status === "denied" || status === "needs_review" ? status : "pending",
    kind,
    note: raw.note,
    submittedAt: raw.submittedAt ?? now,
    updatedAt: raw.updatedAt ?? raw.submittedAt ?? now,
  };
}

export function expandBlockDates(block: TimeOffBlock): string[] {
  if (block.dates?.length) return sortIsoDates(block.dates);
  if (block.startDate && block.endDate) return eachDayInRange(block.startDate, block.endDate);
  return [];
}

/** Marker kind for calendar chips — sick stays sick; others map to vacation styling. */
export function timeOffMarkerKind(kind: TimeOffRequestKind): "vacation" | "sick" {
  return kind === "sick" ? "sick" : "vacation";
}

export function formatDatesSummary(dates: string[]): string {
  if (!dates.length) return "—";
  if (dates.length === 1) return dates[0]!;
  if (dates.length <= 3) return dates.join(", ");
  return `${dates[0]} – ${dates[dates.length - 1]} (${dates.length} days)`;
}
