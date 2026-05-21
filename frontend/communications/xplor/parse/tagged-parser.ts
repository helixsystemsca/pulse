/**
 * Parse Xplor-tagged plain text into legacy program blocks (first structural pass).
 */

import type { XplorParseResult, XplorProgram, XplorStyleKey, XplorTaggedBlock } from "../schema/publication";
import { stripTagCorruption } from "./session-parser";

const PSTYLE_LINE = /^(?:<)?pstyle:([A-Za-z][A-Za-z0-9_]*)>?\s*(.*)$/i;

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

function appendToField(
  program: XplorProgram,
  field: keyof XplorProgram | "sessions" | "extraFees",
  line: string,
) {
  const chunk = stripTagCorruption(line);
  if (!chunk) return;
  if (field === "sessions") {
    program.sessions.push(chunk);
    return;
  }
  if (field === "extraFees") {
    program.extraFees = program.extraFees ? `${program.extraFees}\n${chunk}` : chunk;
    return;
  }
  const key = field as "age" | "title" | "description" | "location" | "instructor";
  const cur = program[key];
  program[key] = cur ? `${cur}\n${chunk}` : chunk;
}

/**
 * Xplor brochure exports usually order fields:
 *   Eventname → Eventdescription → Eventage → Location → Instructor → Eventdetail
 * Eventage must NOT start a new block when the current program has no age yet.
 */
function shouldStartNewProgram(program: XplorProgram | null, styleLower: string): boolean {
  if (!program || !programHasContent(program)) {
    return styleLower === "eventage" || styleLower === "eventname";
  }
  if (styleLower === "eventname" && program.title) return true;
  if (styleLower === "eventage" && program.age) return true;
  return false;
}

function pushProgram(programs: XplorProgram[], program: XplorProgram | null) {
  if (program && programHasContent(program)) programs.push(program);
}

/** Parse tagged Xplor export text into program structures. */
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
      const trimmed = stripTagCorruption(line);
      if (!trimmed) continue;
      if (!current) {
        preambleLines.push(trimmed);
        continue;
      }
      if (lastField === "instructor") {
        const continuingInstructor =
          /^Instructor:\s*/i.test(trimmed) ||
          /^Instructor:\s*$/i.test(current.instructor.trim());
        if (continuingInstructor) {
          appendToField(current, "instructor", trimmed);
        } else {
          warnings.push(
            `Ignored orphan line after Instructor tag: ${trimmed.slice(0, 60)}`,
          );
        }
      } else if (lastField) {
        appendToField(current, lastField, trimmed);
      } else {
        warnings.push(`Orphan line without pstyle: ${trimmed.slice(0, 60)}`);
      }
      continue;
    }

    const styleRaw = m[1] as XplorStyleKey;
    const styleLower = styleRaw.toLowerCase();
    const content = stripTagCorruption(m[2] ?? "");

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

    if (mapped === "instructor") {
      if (content) appendToField(current, "instructor", content);
      lastField = content ? mapped : null;
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
