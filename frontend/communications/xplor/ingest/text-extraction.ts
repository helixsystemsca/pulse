/**
 * Format adapter layer — .txt and .rtf both normalize to plain text before shared parsing.
 */

import { looksLikeXplorTaggedText } from "./detect-xplor";
import { looksLikeRtfPayload, stripRtfToPlain } from "./rtf";

export type PublicationInputFormat = "txt" | "rtf" | "unknown";

export type IngestResult = {
  plainText: string;
  isXplorTagged: boolean;
};

/** Infer format from filename and/or raw bytes (RTF signature). */
export function detectInputFormat(filename?: string | null, raw?: string): PublicationInputFormat {
  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "rtf") return "rtf";
    if (ext === "txt") return "txt";
  }
  if (raw && looksLikeRtfPayload(raw)) return "rtf";
  if (filename) return "unknown";
  return "txt";
}

export { looksLikeRtfPayload } from "./rtf";

/** Shared post-extraction cleanup before tagged-text parsing. */
export function normalizeInputText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extract plain text from raw file contents based on format (no Xplor detection). */
export function extractPlainTextFromRaw(raw: string, format: PublicationInputFormat): string {
  if (!raw) return "";
  const effective: PublicationInputFormat =
    format === "unknown" ? (looksLikeRtfPayload(raw) ? "rtf" : "txt") : format;

  if (effective === "rtf") {
    return stripRtfToPlain(raw);
  }
  return raw;
}

export type PreprocessInputOptions = {
  filename?: string | null;
  /** When omitted, inferred from filename and raw payload. */
  format?: PublicationInputFormat;
};

/**
 * Full ingest preprocessor: format adapter → normalize → Xplor tag detection.
 * All parsers consume `plainText` from this function only.
 */
export function preprocessInput(
  raw: string,
  options: PreprocessInputOptions = {},
): IngestResult & { sourceFormat: PublicationInputFormat } {
  const sourceFormat =
    options.format && options.format !== "unknown"
      ? options.format
      : detectInputFormat(options.filename, raw);

  const extracted = extractPlainTextFromRaw(raw, sourceFormat);
  const plainText = normalizeInputText(extracted);

  return {
    plainText,
    isXplorTagged: looksLikeXplorTaggedText(plainText),
    sourceFormat,
  };
}

/** Browser upload helper — reads file as UTF-8 text, then runs preprocessInput. */
export async function extractTextFromFile(file: File): Promise<{
  plainText: string;
  sourceFormat: PublicationInputFormat;
  isXplorTagged: boolean;
}> {
  const raw = await readFileAsText(file);
  const result = preprocessInput(raw, { filename: file.name });
  return {
    plainText: result.plainText,
    sourceFormat: result.sourceFormat,
    isXplorTagged: result.isXplorTagged,
  };
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
