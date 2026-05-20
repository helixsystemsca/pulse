import { stripRtfToPlain } from "./rtf";

export { stripRtfToPlain } from "./rtf";

export type IngestResult = {
  plainText: string;
  isXplorTagged: boolean;
};

/** True when text likely contains Xplor paragraph styles. */
export function looksLikeXplorTaggedText(text: string): boolean {
  return /pstyle:\s*Event/i.test(text);
}

/** Ingest raw upload/paste: RTF strip + source detection. */
export function ingestPublicationSource(raw: string): IngestResult {
  const plainText = stripRtfToPlain(raw);
  return {
    plainText,
    isXplorTagged: looksLikeXplorTaggedText(plainText),
  };
}
