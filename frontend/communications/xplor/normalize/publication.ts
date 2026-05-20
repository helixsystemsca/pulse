import {
  applyOcrPhraseFixes,
  collapseWhitespace,
  normalizeAgeText,
  normalizeFreeformLine,
  normalizeMoneyInText,
  stripLocationLabel,
} from "./text-cleanup";
import type { PublicationEntry, PublicationSession } from "../schema/publication";

function normalizeSession(session: PublicationSession, ageRange: string): PublicationSession {
  return {
    ...session,
    ageGroup: session.ageGroup ? normalizeAgeText(session.ageGroup) : ageRange,
    days: normalizeFreeformLine(session.days),
    time: normalizeFreeformLine(session.time),
    startDate: normalizeFreeformLine(session.startDate),
    endDate: normalizeFreeformLine(session.endDate),
    price: normalizeMoneyInText(normalizeFreeformLine(session.price)),
    rawLine: normalizeFreeformLine(session.rawLine),
  };
}

export function normalizePublicationEntry(entry: PublicationEntry): PublicationEntry {
  const ageRange = normalizeAgeText(entry.ageRange);
  const sessions = entry.sessions
    .map((s) => normalizeSession(s, ageRange))
    .filter((s) => s.rawLine.length > 0);

  return {
    ...entry,
    title: collapseWhitespace(applyOcrPhraseFixes(entry.title)),
    ageRange,
    description: collapseWhitespace(applyOcrPhraseFixes(entry.description)),
    location: stripLocationLabel(entry.location),
    instructor: collapseWhitespace(entry.instructor),
    extraFees: normalizeMoneyInText(applyOcrPhraseFixes(entry.extraFees)),
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
