import { parseSessionLines } from "../parse/session-parser";
import type { PublicationEntry, XplorProgram } from "./publication";

/** Map legacy tagged parse rows → canonical publication entries (sessions still raw strings). */
export function mapProgramsToPublicationEntries(programs: XplorProgram[]): PublicationEntry[] {
  return programs.map((p) => ({
    id: p.id,
    title: p.title,
    ageRange: p.age,
    description: p.description,
    location: p.location,
    instructor: p.instructor,
    sessions: parseSessionLines(p.sessions, p.age),
    sessionGroups: [],
    tags: [],
    extraFees: p.extraFees,
    sourceMetadata: {
      unmappedBlocks: p.extraBlocks.map((b) => ({ style: b.style, content: b.content })),
    },
    warnings: [],
    confidence: 1,
  }));
}
