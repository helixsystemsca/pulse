/** Period statuses where workers may submit availability (matches schedule period workflow). */
const OPEN_STATUSES = new Set(["draft", "open"]);

/** First period in `draft` or `open`, or empty string (worker flows should not default to a closed period). */
export function firstOpenSchedulePeriodId(periods: { id: string; status: string }[]): string {
  const open = periods.find((p) => OPEN_STATUSES.has((p.status || "").toLowerCase().trim()));
  return open?.id ?? "";
}

/** Open period if any; else first period (supervisor grid may still need a selected period). */
export function preferSchedulePeriodIdForSupervisor(periods: { id: string; status: string }[]): string {
  return firstOpenSchedulePeriodId(periods) || periods[0]?.id || "";
}

export function hasOpenAvailabilityPeriod(periods: { status: string }[]): boolean {
  return periods.some((p) => OPEN_STATUSES.has((p.status || "").toLowerCase().trim()));
}

/** `YYYY-MM` from an ISO date (`YYYY-MM-DD`). */
export function scheduleMonthFromStartDate(startDate: string): string {
  return startDate.slice(0, 7);
}

/** First and last calendar day for a schedule period month (`YYYY-MM`). */
export function boundsForScheduleMonth(month: string): { start_date: string; end_date: string } {
  const [yStr, mStr] = month.split("-");
  const year = Number(yStr);
  const monthNum = Number(mStr);
  if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
    throw new Error("Invalid month");
  }
  const start_date = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const end_date = `${year}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start_date, end_date };
}

export function isMayScheduleMonth(month: string): boolean {
  return /^\d{4}-05$/.test(month);
}

/** Default month when opening the create-period modal (May of current year for assignment testing). */
export function defaultCreateScheduleMonth(): string {
  return `${new Date().getFullYear()}-05`;
}

export function findUnpublishedMayPeriod<T extends { start_date: string; status: string }>(
  periods: T[],
): T | undefined {
  return periods.find((p) => p.start_date.slice(5, 7) === "05" && p.status !== "published");
}
