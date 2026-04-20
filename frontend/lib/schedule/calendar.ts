/** Parse YYYY-MM-DD as local date (no UTC shift). */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

export function endOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0);
}

export type MonthCell = {
  date: string;
  inMonth: boolean;
  dayOfMonth: number;
};

/** Sunday-first grid cells for a month view (includes leading/trailing padding). */
export function monthGrid(year: number, monthIndex: number): MonthCell[] {
  const first = startOfMonth(year, monthIndex);
  const last = endOfMonth(year, monthIndex);
  const lead = first.getDay();
  const daysInMonth = last.getDate();
  const cells: MonthCell[] = [];

  const padStart = new Date(year, monthIndex, 1 - lead);
  for (let i = 0; i < lead; i++) {
    const d = new Date(padStart);
    d.setDate(padStart.getDate() + i);
    cells.push({
      date: formatLocalDate(d),
      inMonth: false,
      dayOfMonth: d.getDate(),
    });
  }

  for (let dom = 1; dom <= daysInMonth; dom++) {
    const d = new Date(year, monthIndex, dom);
    cells.push({
      date: formatLocalDate(d),
      inMonth: true,
      dayOfMonth: dom,
    });
  }

  const tail = 42 - cells.length;
  const after = new Date(year, monthIndex, daysInMonth + 1);
  for (let i = 0; i < tail; i++) {
    const d = new Date(after);
    d.setDate(after.getDate() + i);
    cells.push({
      date: formatLocalDate(d),
      inMonth: false,
      dayOfMonth: d.getDate(),
    });
  }

  return cells;
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** Move a local calendar date by `deltaDays` (can be negative). */
export function addDaysToIso(iso: string, deltaDays: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + deltaDays);
  return formatLocalDate(d);
}

/** Monday (YYYY-MM-DD) of the Mon–Sun week containing `anchorIso`. */
export function mondayOfCalendarWeek(anchorIso: string): string {
  const d = parseLocalDate(anchorIso);
  const dow = d.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
  return formatLocalDate(mon);
}

/** Sunday-first list of seven YYYY-MM-DD strings for the week containing `anchorIso`. */
export function weekDatesFromSunday(anchorIso: string): string[] {
  const d = parseLocalDate(anchorIso);
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(sun);
    x.setDate(sun.getDate() + i);
    dates.push(formatLocalDate(x));
  }
  return dates;
}

/** Short label for a week range, e.g. "Jan 5 – Jan 11, 2025". */
export function weekRangeLabel(dates: string[]): string {
  if (dates.length < 2) return "";
  const a = parseLocalDate(dates[0]);
  const b = parseLocalDate(dates[dates.length - 1]);
  const y = a.getFullYear();
  const sameYear = y === b.getFullYear();
  const optA: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const optB: Intl.DateTimeFormatOptions = sameYear
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" };
  return `${a.toLocaleDateString("en-US", optA)} – ${b.toLocaleDateString("en-US", optB)}, ${b.getFullYear()}`;
}

/** Minutes from midnight for HH:mm */
export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function shiftHours(start: string, end: string): number {
  const a = parseTimeToMinutes(start);
  let b = parseTimeToMinutes(end);
  if (b <= a) b += 24 * 60;
  return (b - a) / 60;
}

/** Every calendar date from start through end (inclusive), as YYYY-MM-DD. */
export function expandInclusiveDateRange(startIso: string, endIso: string): string[] {
  const a = parseLocalDate(startIso);
  const b = parseLocalDate(endIso);
  if (b < a) return [];
  const out: string[] = [];
  const d = new Date(a);
  while (d <= b) {
    out.push(formatLocalDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
