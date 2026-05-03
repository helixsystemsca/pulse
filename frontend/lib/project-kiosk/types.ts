/**
 * Project kiosk display — view model types only (no DB row shapes here).
 * UI renders exclusively from {@link ProjectKioskView}.
 */

export type TeamHighlight = {
  user: string;
  badge: string;
  description: string;
};

/** Workers shown as “on site” in the project kiosk header (from in-progress assignments). */
export type KioskOnSiteWorker = {
  id: string;
  firstName: string;
  displayName: string;
  avatarUrl?: string | null;
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
    /** Tenant / facility line above the project title. */
    facilityLabel: string;
    projectName: string;
    /** Target completion (ISO calendar date). */
    targetEndDate: string | null;
    /** Shown under target date, e.g. “5 days remaining” or “9 days overdue”. */
    targetEndCaption: string;
    targetEndTone: "default" | "warning" | "danger";
    percentComplete: number;
    tasksRemaining: number;
    blockedCount: number;
    onSiteWorkers: KioskOnSiteWorker[];
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
