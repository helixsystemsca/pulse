import type { SchedulePeriodLite } from "@/components/schedule/SchedulePeriodModal";

/** Explicit schedule lifecycle — UI derives from this only. */
export type ScheduleState = "empty" | "draft_generated" | "draft_saved" | "published" | "archived";

export type ScheduleWorkflowMode = "planning" | "operational";

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
  helperText: string;
  steps: ScheduleWorkflowStep[];
  assignmentsEnabled: boolean;
};

export type DeriveScheduleWorkflowInput = {
  activePeriod: SchedulePeriodLite | null;
  /** Draft generator panel is open with preview results. */
  hasDraftPreview: boolean;
  /** Unsaved shift edits on server. */
  hasPendingServerSave: boolean;
  /** At least one shift persisted to API in the visible plan. */
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

export function deriveScheduleWorkflow(input: DeriveScheduleWorkflowInput): ScheduleWorkflowViewModel {
  const { activePeriod, hasDraftPreview, hasPendingServerSave, hasPersistedShifts } = input;

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
        return activePeriod ? 1 : 0;
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

  const { statusLabel, statusTone, helperText } = workflowCopy(state, activePeriod, hasPendingServerSave);

  return { state, mode, statusLabel, statusTone, helperText, steps, assignmentsEnabled };
}

function workflowCopy(
  state: ScheduleState,
  period: SchedulePeriodLite | null,
  hasPendingServerSave: boolean,
): Pick<ScheduleWorkflowViewModel, "statusLabel" | "statusTone" | "helperText"> {
  switch (state) {
    case "archived":
      return {
        statusLabel: "Archived",
        statusTone: "archived",
        helperText: "This scheduling period is archived. Create a new period to plan again.",
      };
    case "published":
      return {
        statusLabel: "Published",
        statusTone: "published",
        helperText: "This schedule is operationally active. Use Daily Assignments for routines and near-term work.",
      };
    case "draft_saved":
      return {
        statusLabel: hasPendingServerSave ? "Unsaved changes" : "Draft saved",
        statusTone: hasPendingServerSave ? "warning" : "draft",
        helperText: hasPendingServerSave
          ? "Save changes before publishing."
          : "Publish the schedule to begin assigning work.",
      };
    case "draft_generated":
      return {
        statusLabel: "Draft in review",
        statusTone: "draft",
        helperText: "Save the draft before publishing.",
      };
    case "empty":
    default:
      return {
        statusLabel: period ? "Planning" : "No period",
        statusTone: "neutral",
        helperText: period
          ? "Create and generate a schedule to begin planning."
          : "Create a scheduling period to collect availability and build coverage.",
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
