import type { PublicationEntry, PublicationSession } from "../schema/publication";
import {
  formatAgeRange,
  formatInstructor,
  formatLocation,
  formatProgramText,
  formatSessionDays,
  formatSessionPrice,
  formatSessionTime,
} from "./brochure-format";
import { normalizeDatesInText } from "./text-cleanup";

const XPLOR_PARSE_DEBUG =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_XPLOR_PARSE_DEBUG === "1";

function maybeLogXplorEdgeCase(entry: PublicationEntry, normalized: PublicationEntry): void {
  if (!XPLOR_PARSE_DEBUG || typeof console === "undefined") return;

  const rawAge = entry.ageRange.trim();
  const ageLooksEdge =
    /\d+\s*(?:yrs?|years?)\s*-\s*$/i.test(rawAge) ||
    /^\d+\s*-\s*(?:yrs?|years?)\s*$/i.test(rawAge);
  const costMissing = entry.sessions.some((s) => s.rawLine.includes("$") === false && !s.price);
  const instructorSuspicious =
    /\n/.test(entry.instructor) ||
    (entry.instructor && !/^Instructor:/i.test(entry.instructor) && entry.instructor.length > 80);

  if (!ageLooksEdge && !costMissing && !instructorSuspicious) return;

  console.log({
    rawAge: entry.ageRange,
    rawInstructor: entry.instructor,
    rawDetail: entry.sessions.map((s) => s.rawLine).join(" | "),
    parsedAge: normalized.ageRange,
    parsedInstructor: formatInstructor(normalized.instructor),
    parsedCost: normalized.sessions.map((s) => s.price || null),
  });
}

function normalizeSessionDates(
  startDate: string,
  endDate: string,
): { startDate: string; endDate: string } {
  const s = normalizeDatesInText(startDate.trim());
  const e = normalizeDatesInText(endDate.trim());
  if (!s) return { startDate: "", endDate: e };
  if (!e || s === e) return { startDate: s, endDate: "" };
  return { startDate: s, endDate: e };
}

function normalizeSession(session: PublicationSession, ageRange: string): PublicationSession {
  const { startDate, endDate } = normalizeSessionDates(session.startDate, session.endDate);

  return {
    ...session,
    ageGroup: session.ageGroup ? formatAgeRange(session.ageGroup) : ageRange,
    days: formatSessionDays(session.days),
    time: formatSessionTime(session.time),
    startDate,
    endDate,
    price: formatSessionPrice(session.price, session.sessionCount),
    rawLine: formatProgramText(session.rawLine),
  };
}

export function normalizePublicationEntry(entry: PublicationEntry): PublicationEntry {
  const ageRange = formatAgeRange(entry.ageRange);
  /** Preserve raw instructor field for Xplor tag fidelity; UI/export apply display formatters. */
  const instructor = entry.instructor.trim();
  const sessions = entry.sessions
    .map((s) => normalizeSession(s, ageRange))
    .filter((s) => s.rawLine.length > 0);

  const normalized = {
    ...entry,
    title: formatProgramText(entry.title),
    ageRange,
    description: formatProgramText(entry.description),
    location: formatLocation(entry.location),
    instructor,
    extraFees: (() => {
      const m = entry.extraFees.match(/^(\$[\d.,]+(?:\/\d+)?|Free)(.*)$/i);
      if (m) {
        const tail = (m[2] ?? "").trim();
        return `${formatSessionPrice(m[1]!, 1)}${tail ? ` ${tail}` : ""}`;
      }
      return formatProgramText(entry.extraFees);
    })(),
    sessions,
  };

  maybeLogXplorEdgeCase(entry, normalized);
  return normalized;
}

export function normalizePublicationEntries(entries: PublicationEntry[]): PublicationEntry[] {
  return entries
    .map(normalizePublicationEntry)
    .filter(
      (e) =>
        e.title ||
        e.ageRange ||
        e.description ||
        e.location ||
        e.sessions.length ||
        e.extraFees,
    );
}
