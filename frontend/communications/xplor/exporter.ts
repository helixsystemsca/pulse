import { attachSessionGroups } from "./export/group-sessions";
import { exportLegacyXplorTaggedText, exportPublicationToIndesignTxt } from "./export/indesign-tagged";
import { normalizePublicationEntries } from "./normalize/publication";
import { mapProgramsToPublicationEntries } from "./schema/map-from-xplor";
import type { PublicationDocument, XplorProgram } from "./schema/publication";

export {
  exportLegacyXplorTaggedText,
  exportPublicationToIndesignTxt,
  countExportParagraphs,
} from "./export/indesign-tagged";
export { exportPublicationToIndesignRtf } from "./export/indesign-rtf";

/** Export via canonical schema → InDesign paragraph styles (primary). */
export function exportProgramsToTaggedText(programs: XplorProgram[], preamble = ""): string {
  const entries = attachSessionGroups(
    normalizePublicationEntries(mapProgramsToPublicationEntries(programs)),
  );
  const doc: PublicationDocument = {
    preamble,
    entries,
    warnings: [],
    confidence: 1,
  };
  return exportPublicationToIndesignTxt(doc);
}
