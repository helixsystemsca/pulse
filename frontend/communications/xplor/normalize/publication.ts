import type { PublicationEntry, PublicationSession } from "../schema/publication";
import { normalizeDatesInText } from "./text-cleanup";
import {
  formatAgeRange,
  formatInstructor,
  formatLocation,
  formatProgramText,
  formatSessionDays,
  formatSessionPrice,
  formatSessionTime,
} from "./brochure-format";

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
  const instructor = formatInstructor(entry.instructor);
  const sessions = entry.sessions
    .map((s) => normalizeSession(s, ageRange))
    .filter((s) => s.rawLine.length > 0);

  return {
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
