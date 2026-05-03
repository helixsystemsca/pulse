/**
 * Project kiosk display — view model types only (no DB row shapes here).
 * UI renders exclusively from {@link ProjectKioskView}.
 */

export type TeamHighlight = {
  user: string;
  badge: string;
  description: string;
};

export type KioskSectionBody =
  | {
      kind: "metrics";
      items: { label: string; value: string; emphasis?: "warning" | "positive" | "neutral" }[];
    }
  | { kind: "task_columns"; columns: { label: string; items: string[] }[] }
  | { kind: "blocked_cards"; items: { title: string; subtitle?: string }[] }
  | { kind: "summary_lines"; lines: string[] }
  | { kind: "insights_cards"; highlights: TeamHighlight[] };

export type KioskSection = {
  id: string;
  title: string;
  isHighValue: boolean;
  body: KioskSectionBody;
};

export type ProjectKioskView = {
  header: {
    name: string;
    percentComplete: number;
    tasksRemaining: number;
    blockedCount: number;
    activeWorkers: number;
    lastUpdated: string;
  };
  lockedSections: KioskSection[];
  rotatingSections: KioskSection[];
  teamInsights: {
    highlights: TeamHighlight[];
  };
};

/** Dashboard / kiosk configuration: which logical panels are “always on”. */
export type KioskWidgetDefinition = {
  id: string;
  label: string;
  /** When true, rendered in the locked panel; otherwise eligible for rotation. */
  isHighValue: boolean;
};
