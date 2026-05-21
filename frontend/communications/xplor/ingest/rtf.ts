import { rtfToTxt } from "rtf-converter";

export function looksLikeRtfPayload(raw: string): boolean {
  const head = raw.slice(0, 4096).trimStart();
  return head.startsWith("{\\rtf") || head.startsWith("{\rtf");
}

/** Regex fallback when `rtf-converter` cannot parse a payload. */
function stripRtfToPlainLegacy(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n");
  s = s
    .replace(/{\*\[^{}]*\}/g, "")
    .replace(/\\'[0-9a-fA-F]{2}/g, (m) => {
      const code = parseInt(m.slice(2), 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    })
    .replace(/\\par\b/g, "\n")
    .replace(/\\line\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\[a-z]+\d* ?/gi, "")
    .replace(/[{}]/g, "");
  return s;
}

/**
 * RTF → plain text (pre-parser). Uses `rtf-converter` with a regex fallback.
 * Plain `.txt` payloads should not be passed here — use {@link extractPlainTextFromRaw}.
 */
export function stripRtfToPlain(raw: string): string {
  if (!raw) return "";
  if (!looksLikeRtfPayload(raw)) return raw;

  try {
    const text = rtfToTxt(raw);
    if (typeof text === "string" && text.trim()) return text;
  } catch {
    /* fall through */
  }
  return stripRtfToPlainLegacy(raw);
}
