/**
 * Rebuild normalized Xplor-tagged text for InDesign place workflow.
 */

import type { XplorProgram } from "./types";

function tag(style: string, content: string): string {
  if (!content.trim()) return "";
  return `<pstyle:${style}>${content.trim()}`;
}

function programToTaggedLines(program: XplorProgram): string[] {
  const lines: string[] = [];
  if (program.age) lines.push(tag("Eventage", program.age));
  if (program.title) lines.push(tag("Eventname", program.title));
  if (program.description) lines.push(tag("Eventdescription", program.description));
  if (program.location) lines.push(tag("Location", program.location));
  if (program.instructor.trim()) lines.push(tag("Instructor", program.instructor));
  for (const session of program.sessions) {
    if (session.trim()) lines.push(tag("Eventdetail", session));
  }
  if (program.extraFees.trim()) {
    lines.push(tag("Extrafee", program.extraFees));
  }
  for (const block of program.extraBlocks) {
    if (block.content.trim()) lines.push(tag(block.style, block.content));
  }
  return lines;
}

/** Export programs as tagged plain text (age before title, cleaned fields). */
export function exportProgramsToTaggedText(programs: XplorProgram[], preamble = ""): string {
  const chunks: string[] = [];
  if (preamble.trim()) chunks.push(preamble.trim());
  for (const program of programs) {
    const block = programToTaggedLines(program);
    if (block.length) chunks.push(block.join("\n"));
  }
  return chunks.join("\n\n").trim();
}
