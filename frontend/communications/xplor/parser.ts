/**
 * Parse Xplor-tagged plain text into structured program objects.
 *
 * Expected tags (case-insensitive):
 * Eventage, Eventname, Eventdescription, Location, Instructor, Eventdetail, Extrafee / Eventfee
 */

import type { XplorParseResult, XplorProgram, XplorStyleKey, XplorTaggedBlock } from "./types";

const PSTYLE_LINE =
  /^(?:<)?pstyle:([A-Za-z][A-Za-z0-9_]*)>?\s*(.*)$/i;

const PROGRAM_START_STYLES = new Set(["eventage", "eventname"]);

const FIELD_MAP: Record<string, keyof XplorProgram | "sessions" | "extraFees" | "extra"> = {
  eventage: "age",
  eventname: "title",
  eventdescription: "description",
  location: "location",
  instructor: "instructor",
  eventdetail: "sessions",
  extrafee: "extraFees",
  eventfee: "extraFees",
  extracost: "extraFees",
};

function newProgram(index: number): XplorProgram {
  return {
    id: `program-${index + 1}`,
    age: "",
    title: "",
    description: "",
    location: "",
    instructor: "",
    sessions: [],
    extraFees: "",
    extraBlocks: [],
  };
}

function programHasContent(p: XplorProgram): boolean {
  return Boolean(
    p.age ||
      p.title ||
      p.description ||
      p.location ||
      p.instructor ||
      p.sessions.length ||
      p.extraFees ||
      p.extraBlocks.length,
  );
}

function appendToField(program: XplorProgram, field: keyof XplorProgram | "sessions" | "extraFees", line: string) {
  const chunk = line.trim();
  if (!chunk) return;
  if (field === "sessions") {
    const last = program.sessions[program.sessions.length - 1];
    if (last && !PSTYLE_LINE.test(line) && program.sessions.length > 0 && line.startsWith(" ")) {
      program.sessions[program.sessions.length - 1] = `${last}\n${chunk}`;
    } else {
      program.sessions.push(chunk);
    }
    return;
  }
  if (field === "extraFees") {
    program.extraFees = program.extraFees ? `${program.extraFees}\n${chunk}` : chunk;
    return;
  }
  if (field === "extraBlocks") return;
  const key = field as "age" | "title" | "description" | "location" | "instructor";
  const cur = program[key];
  program[key] = cur ? `${cur}\n${chunk}` : chunk;
}

function shouldStartNewProgram(program: XplorProgram | null, styleLower: string): boolean {
  if (!program || !programHasContent(program)) return styleLower === "eventage" || styleLower === "eventname";
  if (styleLower === "eventage") return true;
  if (styleLower === "eventname" && program.title) return true;
  return false;
}

function pushProgram(programs: XplorProgram[], program: XplorProgram | null) {
  if (program && programHasContent(program)) programs.push(program);
}

/**
 * Parse tagged Xplor export text (post-RTF strip) into program structures.
 */
export function parseXplorTaggedText(raw: string): XplorParseResult {
  const warnings: string[] = [];
  const preambleLines: string[] = [];
  const programs: XplorProgram[] = [];
  let current: XplorProgram | null = null;
  let programIndex = 0;
  let lastField: keyof XplorProgram | "sessions" | "extraFees" | null = null;

  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const m = line.match(PSTYLE_LINE);
    if (!m) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (!current) {
        preambleLines.push(trimmed);
        continue;
      }
      if (lastField) {
        appendToField(current, lastField, trimmed);
      } else {
        warnings.push(`Orphan line without pstyle: ${trimmed.slice(0, 60)}`);
      }
      continue;
    }

    const styleRaw = m[1] as XplorStyleKey;
    const styleLower = styleRaw.toLowerCase();
    const content = (m[2] ?? "").trim();

    if (shouldStartNewProgram(current, styleLower)) {
      pushProgram(programs, current);
      current = newProgram(programIndex++);
      lastField = null;
    }

    if (!current) {
      if (content) preambleLines.push(`<pstyle:${styleRaw}>${content}`);
      continue;
    }

    const mapped = FIELD_MAP[styleLower];
    if (mapped === "extra" || mapped === undefined) {
      if (content) current.extraBlocks.push({ style: styleRaw, content });
      lastField = null;
      continue;
    }

    if (mapped === "sessions" || mapped === "extraFees") {
      appendToField(current, mapped, content);
      lastField = mapped;
    } else {
      appendToField(current, mapped, content);
      lastField = mapped;
    }
  }

  pushProgram(programs, current);

  if (!programs.length && preambleLines.length === 0 && raw.trim()) {
    warnings.push("No pstyle-tagged programs detected — showing plain-text preview only.");
  }

  return {
    programs,
    preamble: preambleLines.join("\n"),
    warnings,
  };
}

/** True when text likely contains Xplor paragraph styles. */
export function looksLikeXplorTaggedText(text: string): boolean {
  return /pstyle:\s*Event/i.test(text);
}
