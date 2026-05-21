/**
 * Publication pipeline orchestrator — ingest → parse → schema → normalize → validate → export.
 */

import { attachSessionGroups } from "./export/group-sessions";
import { countExportParagraphs, exportPublicationToIndesignTxt } from "./export/indesign-tagged";
import { exportPublicationToIndesignRtf } from "./export/indesign-rtf";
import { preprocessInput } from "./ingest";
import { normalizePublicationEntries } from "./normalize/publication";
import { parseXplorTaggedText } from "./parse/tagged-parser";
import { mapProgramsToPublicationEntries } from "./schema/map-from-xplor";
import type {
  PublicationDocument,
  PublicationPipelineResult,
  XplorPipelineResult,
  XplorProgram,
} from "./schema/publication";
import { validatePublicationDocument } from "./validation";

function toLegacyPrograms(entries: PublicationDocument["entries"]): XplorProgram[] {
  return entries.map((e) => ({
    id: e.id,
    age: e.ageRange,
    title: e.title,
    description: e.description,
    location: e.location,
    instructor: e.instructor,
    sessions: e.sessions.map((s) => s.rawLine || [s.days, s.time, s.startDate, s.price].filter(Boolean).join(" ")),
    extraFees: e.extraFees,
    extraBlocks: (e.sourceMetadata.unmappedBlocks ?? []).map((b) => ({
      style: b.style,
      content: b.content,
    })),
  }));
}

function buildDocument(plainText: string): PublicationDocument {
  const tagged = parseXplorTaggedText(plainText);
  let entries = mapProgramsToPublicationEntries(tagged.programs);
  entries = normalizePublicationEntries(entries);
  entries = attachSessionGroups(entries);

  const doc: PublicationDocument = {
    preamble: tagged.preamble,
    entries,
    warnings: tagged.warnings.map((message) => ({
      code: "parse",
      message,
      severity: "warn" as const,
    })),
    confidence: 1,
  };

  return validatePublicationDocument(doc);
}

/** InDesign-first publication pipeline. */
export function runPublicationPipeline(
  raw: string,
  options?: { filename?: string | null },
): PublicationPipelineResult {
  const { plainText, isXplorTagged } = preprocessInput(raw, { filename: options?.filename });
  if (!isXplorTagged) {
    return {
      plainText,
      isXplorTagged: false,
      document: { preamble: "", entries: [], warnings: [], confidence: 0 },
      export: { taggedTxt: plainText, taggedRtf: "", paragraphCount: 0 },
    };
  }

  const document = buildDocument(plainText);
  const taggedTxt = exportPublicationToIndesignTxt(document);
  const taggedRtf = exportPublicationToIndesignRtf(document);

  return {
    plainText,
    isXplorTagged: true,
    document,
    export: {
      taggedTxt,
      taggedRtf,
      paragraphCount: countExportParagraphs(document),
    },
  };
}

/** Backward-compatible wrapper — includes legacy program shapes + primary InDesign export. */
export function runXplorPipeline(raw: string): XplorPipelineResult {
  const result = runPublicationPipeline(raw);
  const programs = toLegacyPrograms(result.document.entries);
  const parseWarnings = result.document.warnings.map((w) => w.message);

  return {
    parse: {
      programs,
      preamble: result.document.preamble,
      warnings: [
        ...parseWarnings,
        ...result.document.entries.flatMap((e) => e.warnings.map((w) => w.message)),
      ],
    },
    programs,
    exportText: result.export.taggedTxt,
    document: result.document,
    export: result.export,
  };
}
