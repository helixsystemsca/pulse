/**
 * Project kiosk display — view model types only (no DB row shapes here).
 * UI renders exclusively from {@link ProjectKioskView}.
 */

export type TeamHighlight = {
  user: string;
  badge: string;
  description: string;
};

/** Pill tag on a team insight row (icon + label styled by variant). */
export type TeamInsightTag = {
  label: string;
  variant: "teal" | "green" | "orange" | "blue" | "gray";
};

export type TeamInsightMemberRow = {
  workerId: string;
  displayName: string;
  roleLabel: string;
  avatarUrl?: string | null;
  tags: TeamInsightTag[];
};

/** Stats + roster for the kiosk “Team insights” column. */
export type TeamInsightsPanelData = {
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
  };
  members: TeamInsightMemberRow[];
};

/** Workers shown as “on site” in the project kiosk header (from in-progress assignments). */
export type KioskOnSiteWorker = {
  id: string;
  firstName: string;
  displayName: string;
  avatarUrl?: string | null;
};

/** Left rail: scheduled today and/or with active project tasks — no scroll in kiosk shell. */
export type KioskOnShiftWorkerCard = {
  workerId: string;
  firstName: string;
  displayName: string;
  avatarUrl?: string | null;
  /** Active (non-complete) project tasks assigned to this person. */
  assignedTaskTitles: string[];
  /** From schedule assignment or published shift, when available. */
  shiftSummary?: string | null;
};

/** Shown when a person has no tasks — “See … (role)” from project owner / manager fallback. */
export type KioskProjectOwnerHint = {
  displayName: string;
  roleLabel: string;
};

/** One cell in the handover 2×2 grid (filled note vs empty shift slot). */
export type HandoverNoteCard =
  | {
      kind: "filled";
      accent: "teal" | "danger";
      ribbonLabel: string;
      authorName: string;
      metaLine: string;
      body: string;
      statusPill: { tone: "success" | "warning"; label: string } | null;
    }
  | {
      kind: "empty";
      ribbonLabel: string;
      title: string;
      metaLine: string;
      body: string;
    };

export type KioskSectionBody =
  | {
      kind: "metrics";
      items: { label: string; value: string; emphasis?: "warning" | "positive" | "neutral" }[];
    }
  | { kind: "task_columns"; columns: { label: string; items: string[] }[] }
  | { kind: "blocked_cards"; items: { title: string; subtitle?: string }[] }
  | { kind: "summary_lines"; lines: string[] }
  | { kind: "insights_cards"; highlights: TeamHighlight[] }
  | {
      kind: "team_insights_panel";
      stats: TeamInsightsPanelData["stats"];
      members: TeamInsightMemberRow[];
      /** Recognition strip (badges / milestones); kiosk main pane. */
      highlights?: TeamHighlight[];
    }
  | { kind: "handover_notes"; cards: [HandoverNoteCard, HandoverNoteCard, HandoverNoteCard, HandoverNoteCard] }
  | { kind: "safety_reminders"; subtitle: string; cards: SafetyReminderCard[] };

/** One tile on the safety reminders kiosk page (2×3 grid). */
export type SafetyReminderSeverity = "critical" | "caution" | "info" | "emergency";

/** Icon id resolved in the safety page component (Lucide). */
export type SafetyReminderIconId =
  | "shield-alert"
  | "hard-hat"
  | "stethoscope"
  | "phone"
  | "door-open"
  | "map-pin";

export type SafetyReminderCard = {
  severity: SafetyReminderSeverity;
  icon: SafetyReminderIconId;
  tag: string;
  title: string;
  description: string;
};

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
  /** Who is on shift / rostered today and tied to this project, merged with active task assignees. */
  onShiftWorkers: KioskOnShiftWorkerCard[];
  /** Contact line when someone has no tasks today. */
  projectOwnerHint: KioskProjectOwnerHint;
  teamInsights: {
    highlights: TeamHighlight[];
  };
  /** Same payload as `team_insights` widget body when present; used when the widget is off the board. */
  teamInsightsPanel: TeamInsightsPanelData;
};

/** Dashboard / kiosk configuration: which logical panels are “always on”. */
export type KioskWidgetDefinition = {
  id: string;
  label: string;
  /** When true, rendered in the locked panel; otherwise eligible for rotation. */
  isHighValue: boolean;
};
