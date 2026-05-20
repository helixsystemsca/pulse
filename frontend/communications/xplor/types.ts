/** Parsed Xplor program block before / after normalization. */

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

export type XplorTaggedBlock = {
  style: XplorStyleKey;
  content: string;
};

export type XplorProgram = {
  id: string;
  age: string;
  title: string;
  description: string;
  location: string;
  instructor: string;
  /** Session / schedule lines from Eventdetail. */
  sessions: string[];
  extraFees: string;
  /** Unmapped pstyle blocks preserved for export fidelity. */
  extraBlocks: XplorTaggedBlock[];
};

export type XplorParseResult = {
  programs: XplorProgram[];
  /** Non-program preamble (headers, notes) preserved for export. */
  preamble: string;
  warnings: string[];
};

export type XplorPipelineResult = {
  parse: XplorParseResult;
  programs: XplorProgram[];
  exportText: string;
};
