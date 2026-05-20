/**
 * Deterministic InDesign-tagged TXT export — paragraph styles for GREP / import automation.
 */

import type { PublicationDocument, PublicationEntry, PublicationSession } from "../schema/publication";

const BLANK_BETWEEN_PARAGRAPHS = "\n";
const BLANK_BETWEEN_PROGRAMS = "\n\n";

function pstyle(tag: string, content: string): string {
  const t = content.trim();
  if (!t) return "";
  return `<pstyle:${tag}>${t}`;
}

function sessionParagraphs(session: PublicationSession): string[] {
  const lines: string[] = [];
  if (session.sessionLabel) lines.push(pstyle("SessionHeader", session.sessionLabel));
  if (session.days) lines.push(pstyle("SessionDays", session.days));
  if (session.time) lines.push(pstyle("SessionTime", session.time));
  const dateLine =
    session.startDate && session.endDate && session.startDate !== session.endDate
      ? `${session.startDate}–${session.endDate}`
      : session.startDate || session.endDate;
  if (dateLine) lines.push(pstyle("SessionDate", dateLine));
  if (session.price) lines.push(pstyle("SessionPrice", session.price));
  if (session.programCode) lines.push(pstyle("ProgramCode", session.programCode));
  return lines.filter(Boolean);
}

function entryToTaggedBlocks(entry: PublicationEntry): string[] {
  const blocks: string[] = [];

  if (entry.title) blocks.push(pstyle("ProgramTitle", entry.title));
  if (entry.ageRange) blocks.push(pstyle("AgeGroup", entry.ageRange));
  if (entry.description) blocks.push(pstyle("Description", entry.description));
  if (entry.location) blocks.push(pstyle("Location", entry.location));
  if (entry.instructor) blocks.push(pstyle("Instructor", entry.instructor));

  const groups = entry.sessionGroups.length
    ? entry.sessionGroups
    : [{ ageGroup: entry.ageRange, sessions: entry.sessions }];

  for (const group of groups) {
    const showGroupAge =
      group.ageGroup &&
      group.ageGroup !== entry.ageRange &&
      groups.length > 1;
    if (showGroupAge) blocks.push(pstyle("AgeGroup", group.ageGroup));

    group.sessions.forEach((session, index) => {
      const labeled =
        session.sessionLabel || `Session ${String.fromCharCode(65 + (index % 26))}`;
      const sessionLines = sessionParagraphs({ ...session, sessionLabel: labeled });
      if (sessionLines.length) {
        blocks.push(sessionLines.join(BLANK_BETWEEN_PARAGRAPHS));
      }
    });
  }

  if (entry.extraFees.trim()) {
    blocks.push(pstyle("SessionPrice", entry.extraFees));
  }

  for (const block of entry.sourceMetadata.unmappedBlocks ?? []) {
    if (block.content.trim()) blocks.push(pstyle(block.style, block.content));
  }

  return blocks.filter(Boolean);
}

/** Export full document as stable tagged plain text for InDesign Place. */
export function exportPublicationToIndesignTxt(doc: PublicationDocument): string {
  const chunks: string[] = [];
  if (doc.preamble.trim()) chunks.push(doc.preamble.trim());

  for (const entry of doc.entries) {
    const block = entryToTaggedBlocks(entry);
    if (block.length) chunks.push(block.join(BLANK_BETWEEN_PARAGRAPHS));
  }

  return chunks.join(BLANK_BETWEEN_PROGRAMS).trim();
}

export function countExportParagraphs(doc: PublicationDocument): number {
  const text = exportPublicationToIndesignTxt(doc);
  return text.split("\n").filter((l) => l.trim().length > 0).length;
}

/** Legacy Xplor tag export (Event* styles) for backward compatibility. */
export function exportLegacyXplorTaggedText(
  entries: PublicationEntry[],
  preamble = "",
): string {
  const chunks: string[] = [];
  if (preamble.trim()) chunks.push(preamble.trim());
  for (const e of entries) {
    const lines: string[] = [];
    if (e.ageRange) lines.push(`<pstyle:Eventage>${e.ageRange}`);
    if (e.title) lines.push(`<pstyle:Eventname>${e.title}`);
    if (e.description) lines.push(`<pstyle:Eventdescription>${e.description}`);
    if (e.location) lines.push(`<pstyle:Location>${e.location}`);
    if (e.instructor) lines.push(`<pstyle:Instructor>${e.instructor}`);
    for (const s of e.sessions) {
      const parts = [s.days, s.time, s.startDate, s.endDate, s.price, s.programCode].filter(Boolean);
      if (parts.length) lines.push(`<pstyle:Eventdetail>${parts.join(" ")}`);
      else if (s.rawLine) lines.push(`<pstyle:Eventdetail>${s.rawLine}`);
    }
    if (e.extraFees) lines.push(`<pstyle:Extrafee>${e.extraFees}`);
    if (lines.length) chunks.push(lines.join("\n"));
  }
  return chunks.join("\n\n").trim();
}
