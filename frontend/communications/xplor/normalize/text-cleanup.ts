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

/** Collapse malformed repeated date tokens: Jun 24-Jun 24-Jun 24 → Jun 24 */
export function collapseDuplicateDateRanges(text: string): string {
  let s = text;
  const triple = new RegExp(
    `\\b(${MONTH})\\s+(\\d{1,2})\\s*[-–]\\s*(?:${MONTH})\\s+\\2\\s*[-–]\\s*(?:${MONTH})\\s+\\2\\b`,
    "gi",
  );
  s = s.replace(triple, (_, mon: string, d: string) => `${mon} ${d}`);
  const dup = new RegExp(
    `\\b(${MONTH})\\s+(\\d{1,2})\\s*[-–]\\s*(?:${MONTH})\\s+\\2\\b`,
    "gi",
  );
  s = s.replace(dup, (_, mon: string, d: string) => `${mon} ${d}`);
  return s;
}

/** Jul 06 → Jul 6; Jul 06-Jul 10 → Jul 6–10; Jun 24-Jun 24 → Jun 24 */
export function normalizeDatesInText(text: string): string {
  let s = collapseDuplicateDateRanges(text);
  s = s.replace(
    new RegExp(`\\b(${MONTH})\\s+0(\\d)\\b`, "gi"),
    (_, mon: string, d: string) => `${mon} ${d}`,
  );
  s = s.replace(
    new RegExp(
      `\\b(${MONTH})\\s+(\\d{1,2})\\s*[-–]\\s*(?:${MONTH}\\s+)?(\\d{1,2})\\b`,
      "gi",
    ),
    (_, mon: string, d1: string, d2: string) =>
      d1 === d2 ? `${mon} ${d1}` : `${mon} ${d1}–${d2}`,
  );
  s = s.replace(
    new RegExp(`\\b(${MONTH})\\s+(\\d{1,2})\\s*-\\s*(?:${MONTH})\\s+\\2\\b`, "gi"),
    (_, mon: string, d: string) => `${mon} ${d}`,
  );
  return s;
}

/** 9:00am → 9am; 9:30am unchanged */
export function normalizeTimesInText(text: string): string {
  return text.replace(/\b(\d{1,2}):00\s*(am|pm)\b/gi, (_, h: string, ap: string) => `${h}${ap}`);
}

/** $0 → Free (does not strip multi-session /5 suffix — use formatSessionPrice). */
export function normalizeMoneyInText(text: string): string {
  let s = text.replace(/\$0(?:\/\d+)?\b/g, "Free");
  s = s.replace(/\bFee:\s*\$?0\b/gi, "Fee: Free");
  return s;
}

const AGE_YEAR_UNIT = "(?:yrs?|years?)";

/**
 * Age-only normalization — do not run date/time/money passes (they can corrupt ranges).
 * Preserves numeric digits; converts open-ended trailing "-" to "+ YEARS".
 */
export function normalizeAgeText(age: string): string {
  const s = applyOcrPhraseFixes(age.trim());
  if (!s) return "";

  const fullRange = s.match(
    new RegExp(`^(\\d+)\\s*${AGE_YEAR_UNIT}\\s*-\\s*(\\d+)\\s*${AGE_YEAR_UNIT}\\s*$`, "i"),
  );
  if (fullRange) return `${fullRange[1]}–${fullRange[2]} YEARS`;

  const simpleRange = s.match(
    new RegExp(`^(\\d+)\\s*-\\s*(\\d+)\\s*${AGE_YEAR_UNIT}\\s*$`, "i"),
  );
  if (simpleRange) return `${simpleRange[1]}–${simpleRange[2]} YEARS`;

  const openEndedTrailing = s.match(
    new RegExp(`^(\\d+)\\s*${AGE_YEAR_UNIT}\\s*-\\s*$`, "i"),
  );
  if (openEndedTrailing) return `${openEndedTrailing[1]}+ YEARS`;

  const openEndedLeading = s.match(
    new RegExp(`^(\\d+)\\s*-\\s*${AGE_YEAR_UNIT}\\s*$`, "i"),
  );
  if (openEndedLeading) return `${openEndedLeading[1]}+ YEARS`;

  const plusForm = s.match(new RegExp(`^(\\d+)\\+\\s*${AGE_YEAR_UNIT}\\s*$`, "i"));
  if (plusForm) return `${plusForm[1]}+ YEARS`;

  return collapseWhitespace(s);
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
