/**
 * Canonical publication schema — single source of truth for export, preview, and future channels.
 */

export type PublicationWarning = {
  code: string;
  message: string;
  severity: "info" | "warn" | "error";
  field?: string;
};

/** Structured session row after parse + normalize. */
export type PublicationSession = {
  id: string;
  ageGroup: string;
  days: string;
  time: string;
  startDate: string;
  endDate: string;
  price: string;
  sessionCount: number | null;
  programCode: string;
  /** Optional coordinator label (Session A, Session B, …). */
  sessionLabel: string;
  rawLine: string;
  confidence: number;
  warnings: PublicationWarning[];
};

/** Sessions grouped for brochure-style export (6–9 yrs → Session A, B, …). */
export type SessionAgeGroup = {
  ageGroup: string;
  sessions: PublicationSession[];
};

/** One program / event block in a publication handoff. */
export type PublicationEntry = {
  id: string;
  title: string;
  ageRange: string;
  description: string;
  location: string;
  instructor: string;
  sessions: PublicationSession[];
  sessionGroups: SessionAgeGroup[];
  tags: string[];
  extraFees: string;
  sourceMetadata: {
    legacyStyle?: string;
    unmappedBlocks?: { style: string; content: string }[];
  };
  warnings: PublicationWarning[];
  confidence: number;
};

export type PublicationDocument = {
  preamble: string;
  entries: PublicationEntry[];
  warnings: PublicationWarning[];
  confidence: number;
};

export type PublicationExportResult = {
  taggedTxt: string;
  taggedRtf: string;
  paragraphCount: number;
};

export type PublicationPipelineResult = {
  plainText: string;
  isXplorTagged: boolean;
  document: PublicationDocument;
  export: PublicationExportResult;
};

/** @deprecated Legacy parse shape — use PublicationEntry. */
export type XplorStyleKey =
  | "Eventage"
  | "Eventname"
  | "Eventdescription"
  | "Location"
  | "Instructor"
  | "Eventdetail"
  | "Extrafee"
  | "Eventfee"
  | string;

export type XplorTaggedBlock = { style: XplorStyleKey; content: string };

export type XplorProgram = {
  id: string;
  age: string;
  title: string;
  description: string;
  location: string;
  instructor: string;
  sessions: string[];
  extraFees: string;
  extraBlocks: XplorTaggedBlock[];
};

export type XplorParseResult = {
  programs: XplorProgram[];
  preamble: string;
  warnings: string[];
};

export type XplorPipelineResult = {
  parse: XplorParseResult;
  programs: XplorProgram[];
  exportText: string;
  document: PublicationDocument;
  export: PublicationExportResult;
};
