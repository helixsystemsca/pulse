import { looksLikeXplorTaggedText } from "./detect-xplor";
import { preprocessInput, type IngestResult, type PreprocessInputOptions } from "./text-extraction";

export { looksLikeXplorTaggedText } from "./detect-xplor";
export {
  detectInputFormat,
  extractPlainTextFromRaw,
  extractTextFromFile,
  normalizeInputText,
  preprocessInput,
  type IngestResult,
  type PreprocessInputOptions,
  type PublicationInputFormat,
} from "./text-extraction";
export { looksLikeRtfPayload, stripRtfToPlain } from "./rtf";

/** Ingest raw upload/paste — delegates to {@link preprocessInput}. */
export function ingestPublicationSource(
  raw: string,
  options?: PreprocessInputOptions,
): IngestResult {
  const { sourceFormat: _sf, ...result } = preprocessInput(raw, options);
  return result;
}
