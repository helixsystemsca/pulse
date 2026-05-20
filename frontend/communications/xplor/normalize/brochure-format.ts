/**
 * Brochure / InDesign display formatters — applied after parse, before render & export.
 */

import {
  applyOcrPhraseFixes,
  collapseWhitespace,
  normalizeAgeText,
  normalizeDatesInText,
  normalizeMoneyInText,
  normalizeTimesInText,
  preserveUtf8Typography,
  stripLocationLabel,
} from "./text-cleanup";

/** True when an instructor name should be shown. */
export function hasInstructorName(instructor: string | null | undefined): boolean {
  return Boolean(instructor?.trim());
}

/** Location without "Location:" prefix. */
export function formatLocation(location: string): string {
  return stripLocationLabel(location);
}

/** Age range for brochure header (e.g. 16 - yrs → 16 yrs+). */
export function formatAgeRange(age: string): string {
  return normalizeAgeText(age);
}

/**
 * Collapsed session date line for display/export.
 * Jun 24 + Jun 24 → Jun 24; Jul 6 + Jul 10 → Jul 6–10
 */
export function formatSessionDateRange(startDate: string, endDate: string): string {
  const start = normalizeDatesInText(preserveUtf8Typography(startDate.trim()));
  const end = normalizeDatesInText(preserveUtf8Typography(endDate.trim()));
  if (!start) return end;
  if (!end || start === end) return start;

  const startMonth = start.match(/^([A-Za-z]+)\s+(\d{1,2})/);
  const endMonth = end.match(/^([A-Za-z]+)\s+(\d{1,2})/);
  if (
    startMonth &&
    endMonth &&
    startMonth[1]!.toLowerCase() === endMonth[1]!.toLowerCase()
  ) {
    return `${startMonth[1]} ${startMonth[2]}–${endMonth[2]}`;
  }
  return `${start}–${end}`;
}

/**
 * Session price for brochure/export.
 * - sessionCount 1: $24/1 → $24
 * - sessionCount > 1: $129/5 unchanged
 * - $0 / $0/1 → Free
 */
export function formatSessionPrice(price: string, sessionCount: number | null): string {
  const raw = preserveUtf8Typography(price.trim());
  if (!raw) return "";

  if (/^Free$/i.test(raw)) return "Free";
  if (/^\$0(?:\/\d+)?$/i.test(raw)) return "Free";

  const slash = raw.match(/^\$([\d.,]+)\/(\d+)$/);
  if (slash) {
    const amount = slash[1]!;
    const count = parseInt(slash[2]!, 10);
    const effectiveCount = sessionCount ?? count;
    if (effectiveCount === 1 || count === 1) return `$${amount}`;
    return `$${amount}/${count}`;
  }

  return normalizeMoneyInText(raw);
}

/** Days / time lines for flat session rows. */
export function formatSessionDays(days: string): string {
  return collapseWhitespace(normalizeDatesInText(days));
}

export function formatSessionTime(time: string): string {
  return collapseWhitespace(normalizeTimesInText(time));
}

/** Generic program field (description, title). */
export function formatProgramText(text: string): string {
  return collapseWhitespace(
    normalizeDatesInText(normalizeTimesInText(normalizeMoneyInText(applyOcrPhraseFixes(text)))),
  );
}

export function formatInstructor(instructor: string): string {
  const t = collapseWhitespace(applyOcrPhraseFixes(instructor)).trim();
  return t;
}
