import type { SchedulePeriodLite } from "@/components/schedule/SchedulePeriodModal";

/** Explicit schedule lifecycle — UI derives from this only. */
export type ScheduleState = "empty" | "draft_generated" | "draft_saved" | "published" | "archived";

export type ScheduleWorkflowMode = "planning" | "operational";

export type SchedulePrimaryAction =
  | "create_period"
  | "generate_schedule"
  | "save_changes"
  | "publish_schedule"
  | "open_daily_assignments"
  | "notify_workers";

export type WorkflowStepStatus = "complete" | "current" | "upcoming" | "skipped";

export type ScheduleWorkflowStep = {
  id: string;
  label: string;
  status: WorkflowStepStatus;
};

export type ScheduleWorkflowViewModel = {
  state: ScheduleState;
  mode: ScheduleWorkflowMode;
  statusLabel: string;
  statusTone: "neutral" | "draft" | "warning" | "published" | "archived";
  /** @deprecated UI no longer renders instructional copy — kept for compatibility. */
  helperText: string;
  steps: ScheduleWorkflowStep[];
  assignmentsEnabled: boolean;
  hasPeriod: boolean;
  /** Single dominant action for the current stage. */
  primaryAction: SchedulePrimaryAction | null;
  /** Availability desk, time off, preferences — after period exists, before operations. */
  showAvailabilityTools: boolean;
  showSecondarySave: boolean;
  showSecondaryRebuild: boolean;
  showSecondaryPublish: boolean;
  showSecondaryNotify: boolean;
  showSecondaryEdit: boolean;
};

export type DeriveScheduleWorkflowInput = {
  activePeriod: SchedulePeriodLite | null;
  hasDraftPreview: boolean;
  hasPendingServerSave: boolean;
  hasPersistedShifts: boolean;
};

const WORKFLOW_STEPS = [
  { id: "period", label: "Period" },
  { id: "generate", label: "Generate" },
  { id: "save", label: "Save" },
  { id: "publish", label: "Publish" },
  { id: "assign", label: "Assign" },
] as const;

function periodStatus(state: ScheduleState, period: SchedulePeriodLite | null): ScheduleState {
  if (period?.status === "archived") return "archived";
  if (period?.status === "published") return "published";
  return state;
}

function deriveActions(
  state: ScheduleState,
  hasPeriod: boolean,
  hasPendingServerSave: boolean,
): Pick<
  ScheduleWorkflowViewModel,
  | "primaryAction"
  | "showAvailabilityTools"
  | "showSecondarySave"
  | "showSecondaryRebuild"
  | "showSecondaryPublish"
  | "showSecondaryNotify"
  | "showSecondaryEdit"
> {
  if (!hasPeriod) {
    return {
      primaryAction: "create_period",
      showAvailabilityTools: false,
      showSecondarySave: false,
      showSecondaryRebuild: false,
      showSecondaryPublish: false,
      showSecondaryNotify: false,
      showSecondaryEdit: false,
    };
  }

  switch (state) {
    case "archived":
      return {
        primaryAction: "create_period",
        showAvailabilityTools: false,
        showSecondarySave: false,
        showSecondaryRebuild: false,
        showSecondaryPublish: false,
        showSecondaryNotify: false,
        showSecondaryEdit: false,
      };
    case "published":
      return {
        primaryAction: null,
        showAvailabilityTools: false,
        showSecondarySave: false,
        showSecondaryRebuild: false,
        showSecondaryPublish: false,
        showSecondaryNotify: false,
        showSecondaryEdit: true,
      };
    case "draft_saved":
      return {
        primaryAction: hasPendingServerSave ? "save_changes" : "publish_schedule",
        showAvailabilityTools: true,
        showSecondarySave: hasPendingServerSave,
        showSecondaryRebuild: false,
        showSecondaryPublish: hasPendingServerSave,
        showSecondaryNotify: false,
        showSecondaryEdit: true,
      };
    case "draft_generated":
      return {
        primaryAction: "save_changes",
        showAvailabilityTools: true,
        showSecondarySave: false,
        showSecondaryRebuild: true,
        showSecondaryPublish: false,
        showSecondaryNotify: false,
        showSecondaryEdit: false,
      };
    case "empty":
    default:
      return {
        primaryAction: "generate_schedule",
        showAvailabilityTools: true,
        showSecondarySave: false,
        showSecondaryRebuild: false,
        showSecondaryPublish: false,
        showSecondaryNotify: false,
        showSecondaryEdit: false,
      };
  }
}

export function deriveScheduleWorkflow(input: DeriveScheduleWorkflowInput): ScheduleWorkflowViewModel {
  const { activePeriod, hasDraftPreview, hasPendingServerSave, hasPersistedShifts } = input;
  const hasPeriod = activePeriod != null;

  let state: ScheduleState = "empty";
  if (!activePeriod) {
    state = "empty";
  } else if (hasDraftPreview) {
    state = "draft_generated";
  } else if (hasPendingServerSave && !hasPersistedShifts) {
    state = "draft_generated";
  } else if (hasPersistedShifts) {
    state = "draft_saved";
  } else {
    state = "empty";
  }

  state = periodStatus(state, activePeriod);

  const mode: ScheduleWorkflowMode = state === "published" ? "operational" : "planning";
  const assignmentsEnabled = state === "published";

  const stepIndex = (() => {
    switch (state) {
      case "empty":
        return hasPeriod ? 1 : 0;
      case "draft_generated":
        return 2;
      case "draft_saved":
        return 3;
      case "published":
        return 4;
      case "archived":
        return 4;
      default:
        return 0;
    }
  })();

  const steps: ScheduleWorkflowStep[] = WORKFLOW_STEPS.map((s, i) => ({
    ...s,
    status:
      state === "archived" && s.id === "assign"
        ? "skipped"
        : i < stepIndex
          ? "complete"
          : i === stepIndex
            ? "current"
            : "upcoming",
  }));

  const { statusLabel, statusTone } = workflowStatus(state, activePeriod, hasPendingServerSave);
  const actions = deriveActions(state, hasPeriod, hasPendingServerSave);

  return {
    state,
    mode,
    statusLabel,
    statusTone,
    helperText: "",
    steps,
    assignmentsEnabled,
    hasPeriod,
    ...actions,
  };
}

function workflowStatus(
  state: ScheduleState,
  period: SchedulePeriodLite | null,
  hasPendingServerSave: boolean,
): Pick<ScheduleWorkflowViewModel, "statusLabel" | "statusTone"> {
  switch (state) {
    case "archived":
      return { statusLabel: "Archived", statusTone: "archived" };
    case "published":
      return { statusLabel: "Published", statusTone: "published" };
    case "draft_saved":
      return {
        statusLabel: hasPendingServerSave ? "Unsaved changes" : "Draft saved",
        statusTone: hasPendingServerSave ? "warning" : "draft",
      };
    case "draft_generated":
      return { statusLabel: "Draft in review", statusTone: "draft" };
    case "empty":
    default:
      return {
        statusLabel: period ? "Planning" : "No period",
        statusTone: "neutral",
      };
  }
}

export function pickPeriodForVisibleRange(
  periods: SchedulePeriodLite[],
  visibleStart: string,
  visibleEnd: string,
): SchedulePeriodLite | null {
  const overlaps = (p: SchedulePeriodLite) => p.start_date <= visibleEnd && p.end_date >= visibleStart;
  const candidates = periods.filter(overlaps);
  return (
    candidates.find((p) => p.status === "published") ??
    candidates.find((p) => p.status === "open" || p.status === "draft") ??
    periods.find((p) => p.status === "open" || p.status === "draft") ??
    null
  );
}
