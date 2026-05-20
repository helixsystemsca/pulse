import { exportPublicationToIndesignTxt } from "./indesign-tagged";
import type { PublicationDocument } from "../schema/publication";

function escapeRtf(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\n/g, "\\par\n");
}

/**
 * Minimal RTF wrapper around tagged paragraphs for InDesign Place.
 * Each line becomes one \\par — styles mapped in InDesign via tags.
 */
export function exportPublicationToIndesignRtf(doc: PublicationDocument): string {
  const tagged = exportPublicationToIndesignTxt(doc);
  const body = escapeRtf(tagged);
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs22\n${body}\n}`;
}
