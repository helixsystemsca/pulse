/**
 * Deterministic text cleanup — OCR fixes, typography, dates, times, money.
 */

const OCR_PHRASE_FIXES: ReadonlyArray<[RegExp, string]> = [
  [/\bOne along\b/gi, "Come along"],
  [/\b0ne along\b/gi, "Come along"],
  [/\bl\s*ocation\b/gi, "location"],
  [/\bFee\s*:\s*\$\s*0\b/gi, "Fee: Free"],
];

const MONTH =
  "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";

/** Preserve typographic punctuation; strip mojibake control chars. */
export function preserveUtf8Typography(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ")
    .normalize("NFC");
}

export function applyOcrPhraseFixes(text: string): string {
  let s = preserveUtf8Typography(text);
  for (const [re, rep] of OCR_PHRASE_FIXES) {
    s = s.replace(re, rep);
  }
  return s;
}

export function collapseWhitespace(text: string): string {
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Jul 06 → Jul 6; Jul 06-Jul 10 → Jul 6–10 */
export function normalizeDatesInText(text: string): string {
  let s = text;
  s = s.replace(
    new RegExp(`\\b(${MONTH})\\s+0(\\d)\\b`, "gi"),
    (_, mon: string, d: string) => `${mon} ${d}`,
  );
  s = s.replace(
    new RegExp(
      `\\b(${MONTH})\\s+(\\d{1,2})\\s*[-–]\\s*(?:${MONTH}\\s+)?(\\d{1,2})\\b`,
      "gi",
    ),
    (_, mon: string, d1: string, d2: string) => `${mon} ${d1}–${d2}`,
  );
  s = s.replace(
    new RegExp(`\\b(${MONTH})\\s+(\\d{1,2})\\s*-\\s*(?:${MONTH})\\s+\\2\\b`, "gi"),
    (_, mon: string, d: string) => `${mon} ${d}`,
  );
  return s;
}

/** 9:00am → 9am */
export function normalizeTimesInText(text: string): string {
  return text.replace(/\b(\d{1,2}):00\s*(am|pm)\b/gi, (_, h: string, ap: string) => `${h}${ap}`);
}

/** $0 → Free; $24/1 → $24 (count parsed separately) */
export function normalizeMoneyInText(text: string): string {
  let s = text.replace(/\$0\b/g, "Free");
  s = s.replace(/\bFee:\s*\$?0\b/gi, "Fee: Free");
  s = s.replace(/\$(\d+(?:\.\d{2})?)\/\d+\b/g, (_, amount: string) => `$${amount}`);
  return s;
}

export function normalizeAgeText(age: string): string {
  let s = applyOcrPhraseFixes(age.trim());
  const singleMalformed = s.match(/^(\d+)\s*-\s*yrs\s*$/i);
  if (singleMalformed) return `${singleMalformed[1]} yrs+`;
  return collapseWhitespace(
    normalizeDatesInText(normalizeTimesInText(normalizeMoneyInText(s))),
  );
}

export function stripLocationLabel(location: string): string {
  return applyOcrPhraseFixes(location)
    .replace(/^Location:\s*/i, "")
    .trim();
}

export function normalizeFreeformLine(line: string): string {
  return collapseWhitespace(
    normalizeDatesInText(normalizeTimesInText(normalizeMoneyInText(applyOcrPhraseFixes(line)))),
  );
}
