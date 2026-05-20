import { attachSessionGroups } from "./export/group-sessions";
import { normalizePublicationEntries } from "./normalize/publication";
import { mapProgramsToPublicationEntries } from "./schema/map-from-xplor";
import type { XplorProgram } from "./schema/publication";

export {
  applyOcrPhraseFixes,
  collapseWhitespace,
  normalizeAgeText,
  normalizeDatesInText,
  normalizeFreeformLine,
  normalizeMoneyInText,
  normalizeTimesInText,
  preserveUtf8Typography,
  stripLocationLabel,
} from "./normalize/text-cleanup";

import { normalizeFreeformLine as normalizeSessionLineImpl } from "./normalize/text-cleanup";

/** @deprecated Alias for normalizeFreeformLine */
export function normalizeSessionLine(line: string): string {
  return normalizeSessionLineImpl(line);
}

export function normalizeProgram(program: XplorProgram): XplorProgram {
  const [entry] = normalizePublicationEntries(mapProgramsToPublicationEntries([program]));
  if (!entry) return program;
  return {
    id: entry.id,
    age: entry.ageRange,
    title: entry.title,
    description: entry.description,
    location: entry.location,
    instructor: entry.instructor,
    sessions: entry.sessions.map((s) => s.rawLine),
    extraFees: entry.extraFees,
    extraBlocks: (entry.sourceMetadata.unmappedBlocks ?? []).map((b) => ({
      style: b.style,
      content: b.content,
    })),
  };
}

export function normalizePrograms(programs: XplorProgram[]): XplorProgram[] {
  const entries = attachSessionGroups(
    normalizePublicationEntries(mapProgramsToPublicationEntries(programs)),
  );
  return entries.map((e) => ({
    id: e.id,
    age: e.ageRange,
    title: e.title,
    description: e.description,
    location: e.location,
    instructor: e.instructor,
    sessions: e.sessions.map((s) => s.rawLine),
    extraFees: e.extraFees,
    extraBlocks: (e.sourceMetadata.unmappedBlocks ?? []).map((b) => ({
      style: b.style,
      content: b.content,
    })),
  }));
}
