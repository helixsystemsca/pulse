export type * from "./schema/publication";
export { ingestPublicationSource, looksLikeXplorTaggedText } from "./ingest";
export { parseXplorTaggedText } from "./parse/tagged-parser";
export { parseSessionBlob, parseSessionLines, stripTagCorruption } from "./parse/session-parser";
export { mapProgramsToPublicationEntries } from "./schema/map-from-xplor";
export { normalizePublicationEntries } from "./normalize/publication";
export {
  applyOcrPhraseFixes,
  normalizeAgeText,
  normalizeFreeformLine,
  normalizePrograms,
  normalizeSessionLine,
  preserveUtf8Typography,
} from "./normalizer";
export { validatePublicationDocument } from "./validation";
export { groupSessionsByAge, attachSessionGroups } from "./export/group-sessions";
export {
  exportPublicationToIndesignTxt,
  exportPublicationToIndesignRtf,
  exportLegacyXplorTaggedText,
  exportProgramsToTaggedText,
} from "./exporter";
export { runPublicationPipeline, runXplorPipeline } from "./pipeline";

export { looksLikeXplorTaggedText as isXplorTaggedInput } from "./ingest";
export { stripRtfToPlain } from "./ingest/rtf";
