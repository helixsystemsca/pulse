/** One worker time-off span shown on the operations workforce tile. */
export type WorkforceTimeOffEntry = {
  id: string;
  displayName: string;
  initials: string;
  avatar_url?: string | null;
  /** Human-readable range(s), e.g. "June 6th – 9th, June 15th – 16th". */
  dateLabel: string;
};

export type WorkforceTimeOffWorkerRef = {
  id: string;
  full_name?: string | null;
  email: string;
  avatar_url?: string | null;
};

export type WorkforceTimeOffBlockRef = {
  id: string;
  workerId: string;
  status: string;
  dates?: string[];
  startDate?: string;
  endDate?: string;
};

function workerInitials(fullName: string | null | undefined, email: string): string {
  const base = (fullName || email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  const mod10 = day % 10;
  if (mod10 === 1) return `${day}st`;
  if (mod10 === 2) return `${day}nd`;
  if (mod10 === 3) return `${day}rd`;
  return `${day}th`;
}

function expandBlockDates(block: WorkforceTimeOffBlockRef): string[] {
  if (block.dates?.length) return [...block.dates].sort();
  if (block.startDate && block.endDate) {
    const out: string[] = [];
    const cur = new Date(`${block.startDate}T12:00:00`);
    const end = new Date(`${block.endDate}T12:00:00`);
    while (cur <= end) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }
  return [];
}

function monthBounds(ref: Date): { start: string; end: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const start = new Date(y, m, 1).toISOString().slice(0, 10);
  const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

function groupConsecutiveDates(dates: string[]): { start: string; end: string }[] {
  if (!dates.length) return [];
  const ranges: { start: string; end: string }[] = [];
  let start = dates[0]!;
  let prev = dates[0]!;
  for (let i = 1; i < dates.length; i++) {
    const d = dates[i]!;
    const nextDay = new Date(`${prev}T12:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    const expected = nextDay.toISOString().slice(0, 10);
    if (d === expected) {
      prev = d;
      continue;
    }
    ranges.push({ start, end: prev });
    start = d;
    prev = d;
  }
  ranges.push({ start, end: prev });
  return ranges;
}

function formatRangeLabel(start: string, end: string): string {
  const sd = new Date(`${start}T12:00:00`);
  const ed = new Date(`${end}T12:00:00`);
  const month = sd.toLocaleDateString("en-US", { month: "long" });
  if (start === end) return `${month} ${ordinal(sd.getDate())}`;
  if (sd.getMonth() === ed.getMonth() && sd.getFullYear() === ed.getFullYear()) {
    return `${month} ${ordinal(sd.getDate())} – ${ordinal(ed.getDate())}`;
  }
  const endMonth = ed.toLocaleDateString("en-US", { month: "long" });
  return `${month} ${ordinal(sd.getDate())} – ${endMonth} ${ordinal(ed.getDate())}`;
}

/** Approved schedule time-off overlapping the given month (from persisted schedule store). */
export function buildWorkforceTimeOffThisMonth(
  workers: WorkforceTimeOffWorkerRef[],
  timeOffBlocks: WorkforceTimeOffBlockRef[],
  referenceDate: Date = new Date(),
): WorkforceTimeOffEntry[] {
  const workerById = new Map(workers.map((w) => [w.id, w]));
  const { start: monthStart, end: monthEnd } = monthBounds(referenceDate);
  const datesByWorker = new Map<string, string[]>();

  for (const block of timeOffBlocks) {
    if (block.status !== "approved") continue;
    const inMonth = expandBlockDates(block).filter((d) => d >= monthStart && d <= monthEnd);
    if (!inMonth.length || !workerById.has(block.workerId)) continue;
    const existing = datesByWorker.get(block.workerId) ?? [];
    datesByWorker.set(block.workerId, [...new Set([...existing, ...inMonth])].sort());
  }

  const entries: { entry: WorkforceTimeOffEntry; sortKey: string }[] = [];
  for (const [workerId, sorted] of datesByWorker) {
    const worker = workerById.get(workerId)!;
    const labels = groupConsecutiveDates(sorted).map((r) => formatRangeLabel(r.start, r.end));
    entries.push({
      sortKey: sorted[0] ?? "",
      entry: {
        id: `to-${workerId}`,
        displayName: worker.full_name?.trim() || worker.email.split("@")[0] || worker.email,
        initials: workerInitials(worker.full_name, worker.email),
        avatar_url: worker.avatar_url ?? null,
        dateLabel: labels.join(", "),
      },
    });
  }

  return entries
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.entry.displayName.localeCompare(b.entry.displayName))
    .map((row) => row.entry);
}
