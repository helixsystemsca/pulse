/**
 * Parse Eventdetail / OCR session blobs into structured session objects.
 */

import { normalizeFreeformLine } from "../normalize/text-cleanup";
import type { PublicationSession, PublicationWarning } from "../schema/publication";

const MONTH =
  "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";

const DAYS_PATTERN =
  /\b(?:Daily|Weekdays|Weekends?|M-F|Mon-Fri|T(?:ue?s?)?-Th(?:ur?s?)?(?:-Fri)?|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:\s*[,/&]\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun))*)\b/i;

const TIME_RANGE_PATTERN =
  /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)(?:\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))?)\b/i;

const DATE_RANGE_PATTERN = new RegExp(
  `\\b(${MONTH})\\s+(\\d{1,2})(?:\\s*[-–]\\s*(?:(${MONTH})\\s+)?(\\d{1,2}))?`,
  "gi",
);

const PRICE_PATTERN =
  /(?:^|\s)(?:Fee:\s*)?(\$[\d.,]+(?:\/\d+)?|Free)(?=\s|$)/i;

const PROGRAM_CODE_PATTERN = /\b(\d{5,7})\s*$/;

let sessionCounter = 0;

function nextSessionId(): string {
  sessionCounter += 1;
  return `session-${sessionCounter}`;
}

/** Strip duplicated/corrupted pstyle fragments from OCR lines. */
export function stripTagCorruption(line: string): string {
  return line
    .replace(/\[pstyle:[^\]\n>]*\]/gi, "")
    .replace(/<pstyle:[^>\n]+>/gi, "")
    .replace(/\(pstyle:[^)]*\)/gi, "")
    .replace(/\bpstyle:[A-Za-z][A-Za-z0-9_]*\b/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function warn(code: string, message: string): PublicationWarning {
  return { code, message, severity: "warn" };
}

function extractDays(text: string): string {
  const m = text.match(DAYS_PATTERN);
  return m ? m[0].trim() : "";
}

function extractTime(text: string): string {
  const m = text.match(TIME_RANGE_PATTERN);
  return m ? normalizeFreeformLine(m[0]) : "";
}

function extractDates(text: string): { startDate: string; endDate: string; rest: string } {
  let startDate = "";
  let endDate = "";
  let rest = text;
  const matches = [...text.matchAll(DATE_RANGE_PATTERN)];
  if (matches.length === 0) return { startDate, endDate, rest };

  const first = matches[0]!;
  const mon = first[1] ?? "";
  const d1 = first[2] ?? "";
  const mon2 = first[3];
  const d2 = first[4];
  startDate = normalizeFreeformLine(`${mon} ${d1}`);
  endDate = d2 ? normalizeFreeformLine(`${mon2 ?? mon} ${d2}`) : startDate;

  for (const m of matches) {
    rest = rest.replace(m[0], " ");
  }
  return { startDate, endDate, rest: rest.trim() };
}

function parsePriceToken(raw: string): { price: string; sessionCount: number | null } {
  let sessionCount: number | null = null;
  let price = raw;
  const slash = raw.match(/\$([\d.,]+)\/(\d+)/);
  if (slash) {
    price = `$${slash[1]}/${slash[2]}`;
    sessionCount = parseInt(slash[2]!, 10);
  }
  if (/^Free$/i.test(price) || /^\$0(?:\/\d+)?$/i.test(raw)) price = "Free";
  return { price, sessionCount };
}

function extractPrice(text: string): { price: string; sessionCount: number | null; rest: string } {
  const m = text.match(PRICE_PATTERN);
  if (m) {
    const raw = m[1] ?? "";
    const { price, sessionCount } = parsePriceToken(raw);
    const rest = text.replace(m[0], " ").trim();
    return { price, sessionCount, rest };
  }

  const fallback = text.match(/\$\d+(?:\/\d+)?/);
  if (!fallback) return { price: "", sessionCount: null, rest: text };

  const raw = fallback[0];
  const { price, sessionCount } = parsePriceToken(raw);
  const rest = text.replace(raw, " ").trim();
  return { price, sessionCount, rest };
}

function extractProgramCode(text: string): { programCode: string; rest: string } {
  const m = text.match(PROGRAM_CODE_PATTERN);
  if (!m) return { programCode: "", rest: text };
  return { programCode: m[1]!, rest: text.replace(m[0], "").trim() };
}

function sessionLabelForIndex(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  return `Session ${letter}`;
}

function scoreSession(s: Omit<PublicationSession, "id" | "sessionLabel" | "confidence" | "warnings">): {
  confidence: number;
  warnings: PublicationWarning[];
} {
  const warnings: PublicationWarning[] = [];
  let score = 1;

  if (!s.days && !s.time && !s.startDate) {
    warnings.push(warn("session_empty", "Session line has no schedule fields after parsing"));
    score -= 0.45;
  }
  if (!s.price) {
    warnings.push(warn("missing_price", "No price detected on session line"));
    score -= 0.15;
  }
  if (s.startDate && s.endDate && s.startDate === s.endDate && /\d{1,2}–\d{1,2}/.test(s.rawLine)) {
    warnings.push(warn("ambiguous_dates", "Date range may be collapsed — verify start/end"));
    score -= 0.1;
  }
  if (!s.programCode && /\d{5,7}/.test(s.rawLine)) {
    warnings.push(warn("suspicious_code", "Program code pattern present but not extracted"));
    score -= 0.1;
  }

  return { confidence: Math.max(0, Math.min(1, score)), warnings };
}

/**
 * Parse one Eventdetail blob (post-tag-strip) into a structured session.
 */
export function parseSessionBlob(
  rawLine: string,
  defaults: { ageGroup?: string; index?: number } = {},
): PublicationSession {
  const cleaned = stripTagCorruption(rawLine);
  const warnings: PublicationWarning[] = [];

  if (/^Fee:\s*/i.test(cleaned)) {
    const { price, sessionCount } = extractPrice(cleaned);
    const base = {
      ageGroup: defaults.ageGroup ?? "",
      days: "",
      time: "",
      startDate: "",
      endDate: "",
      price: price ?? "",
      sessionCount,
      programCode: "",
      rawLine: normalizeFreeformLine(cleaned),
    };
    const scored = scoreSession(base);
    return {
      id: nextSessionId(),
      ...base,
      sessionLabel: sessionLabelForIndex(defaults.index ?? 0),
      confidence: scored.confidence,
      warnings: [...warnings, ...scored.warnings],
    };
  }

  let working = cleaned;
  const days = extractDays(working);
  if (days) working = working.replace(days, " ");

  const time = extractTime(working);
  if (time) working = working.replace(time, " ");

  const { startDate, endDate, rest: afterDates } = extractDates(working);
  working = afterDates;

  const { price, sessionCount, rest: afterPrice } = extractPrice(working);
  working = afterPrice;

  const { programCode, rest } = extractProgramCode(working);
  if (rest.length > 8 && !days && !time) {
    warnings.push(
      warn("ocr_fragment", `Unparsed session fragment: ${rest.slice(0, 48)}${rest.length > 48 ? "…" : ""}`),
    );
  }

  const base = {
    ageGroup: defaults.ageGroup ?? "",
    days: days ? normalizeFreeformLine(days) : "",
    time: time ? normalizeFreeformLine(time) : "",
    startDate: startDate ? normalizeFreeformLine(startDate) : "",
    endDate: endDate ? normalizeFreeformLine(endDate) : "",
    price: price ?? "",
    sessionCount,
    programCode,
    rawLine: normalizeFreeformLine(cleaned),
  };
  const scored = scoreSession(base);

  return {
    id: nextSessionId(),
    ...base,
    sessionLabel: sessionLabelForIndex(defaults.index ?? 0),
    confidence: scored.confidence,
    warnings: [...warnings, ...scored.warnings],
  };
}

/** Parse multiple session lines for one program. */
export function parseSessionLines(
  lines: string[],
  programAgeRange: string,
): PublicationSession[] {
  sessionCounter = 0;
  return lines
    .map((line, index) =>
      parseSessionBlob(line, {
        ageGroup: programAgeRange,
        index,
      }),
    )
    .filter((s) => s.rawLine.length > 0);
}
