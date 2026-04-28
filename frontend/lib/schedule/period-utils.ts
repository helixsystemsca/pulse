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
