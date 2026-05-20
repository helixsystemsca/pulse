export type { XplorParseResult, XplorPipelineResult, XplorProgram, XplorTaggedBlock } from "./types";
export { exportProgramsToTaggedText } from "./exporter";
export { looksLikeXplorTaggedText, parseXplorTaggedText } from "./parser";
export {
  normalizeAgeText,
  normalizePrograms,
  normalizeSessionLine,
  preserveUtf8Typography,
} from "./normalizer";

import { exportProgramsToTaggedText } from "./exporter";
import { looksLikeXplorTaggedText, parseXplorTaggedText } from "./parser";
import { normalizePrograms } from "./normalizer";
import type { XplorPipelineResult } from "./types";

/** Full pipeline: parse → normalize → export tagged text. */
export function runXplorPipeline(raw: string): XplorPipelineResult {
  const parse = parseXplorTaggedText(raw);
  const programs = normalizePrograms(parse.programs);
  const exportText = exportProgramsToTaggedText(programs, parse.preamble);
  return { parse, programs, exportText };
}

export { looksLikeXplorTaggedText as isXplorTaggedInput };
