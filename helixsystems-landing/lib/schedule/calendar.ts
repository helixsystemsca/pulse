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
