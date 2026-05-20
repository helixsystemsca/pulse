/**
 * Deterministic Xplor field normalization (no AI, no locale surprises).
 */

import type { XplorProgram } from "./types";

/** Preserve typographic punctuation; only strip known mojibake control chars. */
export function preserveUtf8Typography(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u00A0/g, " ")
    .normalize("NFC");
}

/** Jul 06 → Jul 6; Jun 24-Jun 24 → Jun 24 */
export function normalizeDatesInText(text: string): string {
  let s = text;
  s = s.replace(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+0(\d)\b/gi,
    (_, mon: string, d: string) => `${mon} ${d}`,
  );
  s = s.replace(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*-\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\2\b/gi,
    (_, mon: string, d: string) => `${mon} ${d}`,
  );
  return s;
}

/** 9:00am → 9am; 10:30pm stays */
export function normalizeTimesInText(text: string): string {
  return text.replace(/\b(\d{1,2}):00\s*(am|pm)\b/gi, (_, h: string, ap: string) => `${h}${ap}`);
}

/** $0 → Free; $24/1 → $24 */
export function normalizeMoneyInText(text: string): string {
  let s = text.replace(/\$0\b/g, "Free");
  s = s.replace(/\$(\d+(?:\.\d{2})?)\/\d+\b/g, (_, amount: string) => `$${amount}`);
  return s;
}

/** 16 - yrs → 16 yrs+ (single-age malformed pattern; ranges like 3 - 5 yrs kept). */
export function normalizeAgeText(age: string): string {
  let s = preserveUtf8Typography(age.trim());
  const singleMalformed = s.match(/^(\d+)\s*-\s*yrs\s*$/i);
  if (singleMalformed) return `${singleMalformed[1]} yrs+`;
  return normalizeDatesInText(normalizeTimesInText(normalizeMoneyInText(s)));
}

export function stripLocationLabel(location: string): string {
  return preserveUtf8Typography(location)
    .replace(/^Location:\s*/i, "")
    .trim();
}

export function normalizeSessionLine(line: string): string {
  return normalizeDatesInText(normalizeTimesInText(normalizeMoneyInText(preserveUtf8Typography(line.trim()))));
}

export function normalizeProgram(program: XplorProgram): XplorProgram {
  const instructor = preserveUtf8Typography(program.instructor.trim());
  const sessions = program.sessions
    .map(normalizeSessionLine)
    .map((s) => s.trim())
    .filter(Boolean);
  const extraFees = normalizeMoneyInText(preserveUtf8Typography(program.extraFees.trim()));

  return {
    ...program,
    age: normalizeAgeText(program.age),
    title: preserveUtf8Typography(program.title.trim()),
    description: normalizeDatesInText(
      normalizeTimesInText(normalizeMoneyInText(preserveUtf8Typography(program.description.trim()))),
    ),
    location: stripLocationLabel(program.location),
    instructor,
    sessions,
    extraFees,
    extraBlocks: program.extraBlocks
      .map((b) => ({
        ...b,
        content: normalizeDatesInText(
          normalizeTimesInText(normalizeMoneyInText(preserveUtf8Typography(b.content.trim()))),
        ),
      }))
      .filter((b) => b.content),
  };
}

export function normalizePrograms(programs: XplorProgram[]): XplorProgram[] {
  return programs.map(normalizeProgram).filter((p) => {
    return (
      p.age ||
      p.title ||
      p.description ||
      p.location ||
      p.instructor ||
      p.sessions.length ||
      p.extraFees ||
      p.extraBlocks.length
    );
  });
}
