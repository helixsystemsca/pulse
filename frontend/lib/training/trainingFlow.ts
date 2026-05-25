import { acknowledgementCoversRevision } from "@/lib/training/revision";
import type {
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingAssignmentStatus,
  TrainingProgram,
} from "@/lib/training/types";

/** Part 1 = read → acknowledge → quiz. Part 2 = shadow shift + supervisor sign-off. */
export type TrainingFlowStepId =
  | "not_started"
  | "read"
  | "acknowledged"
  | "quiz_retry"
  | "part1_complete"
  | "shadow_pending"
  | "fully_certified"
  | "expiring_soon"
  | "expired"
  | "revision_pending"
  | "not_applicable";

export type TrainingFlowState = {
  step: TrainingFlowStepId;
  phase: "part1" | "part2" | "certified" | "attention";
  /** Short label for matrix / category rows */
  tag: string;
  /** Longer line for checklist meta */
  detail: string;
  part1Complete: boolean;
  fullyCertified: boolean;
  needsWorkerAction: boolean;
};

function requiresVerification(program: TrainingProgram): boolean {
  return program.requires_knowledge_verification !== false;
}

function hasRead(assignment: TrainingAssignment | undefined): boolean {
  return Boolean(assignment?.verification_first_viewed_at);
}

function hasAck(
  program: TrainingProgram,
  latestAck: TrainingAcknowledgement | undefined,
): boolean {
  if (!program.requires_acknowledgement) return true;
  return acknowledgementCoversRevision(latestAck, program.revision_number);
}

function hasQuizPass(assignment: TrainingAssignment | undefined): boolean {
  return Boolean(assignment?.quiz_passed_at);
}

function hasSupervisorSignoff(assignment: TrainingAssignment | undefined): boolean {
  return Boolean(assignment?.supervisor_signoff);
}

export function deriveTrainingFlowState(input: {
  program: TrainingProgram;
  assignment: TrainingAssignment | undefined;
  latestAck: TrainingAcknowledgement | undefined;
  effectiveStatus: TrainingAssignmentStatus;
}): TrainingFlowState {
  const { program, assignment, latestAck, effectiveStatus } = input;

  if (effectiveStatus === "not_applicable" || effectiveStatus === "not_assigned") {
    return {
      step: "not_applicable",
      phase: "attention",
      tag: "N/A",
      detail: "Not assigned to you",
      part1Complete: false,
      fullyCertified: false,
      needsWorkerAction: false,
    };
  }

  if (effectiveStatus === "expired") {
    return {
      step: "expired",
      phase: "attention",
      tag: "Expired",
      detail: "Renew training — start Part 1 again",
      part1Complete: false,
      fullyCertified: false,
      needsWorkerAction: true,
    };
  }

  if (effectiveStatus === "revision_pending") {
    return {
      step: "revision_pending",
      phase: "attention",
      tag: "Revision",
      detail: "Procedure updated — re-read and acknowledge",
      part1Complete: false,
      fullyCertified: false,
      needsWorkerAction: true,
    };
  }

  const signoff = hasSupervisorSignoff(assignment);
  const quizPass = hasQuizPass(assignment);
  const ack = hasAck(program, latestAck);
  const read = hasRead(assignment);
  const attempts = assignment?.quiz_attempt_count ?? 0;
  const latestScore =
    typeof assignment?.quiz_latest_score_percent === "number"
      ? assignment.quiz_latest_score_percent
      : null;

  if (
    signoff &&
    (effectiveStatus === "completed" || effectiveStatus === "expiring_soon")
  ) {
    const expiring = effectiveStatus === "expiring_soon";
    return {
      step: expiring ? "expiring_soon" : "fully_certified",
      phase: "certified",
      tag: expiring ? "Expiring" : "Certified",
      detail: expiring
        ? "Both parts complete — renewal window open"
        : "Part 1 & Part 2 complete — supervisor signed off",
      part1Complete: true,
      fullyCertified: true,
      needsWorkerAction: expiring,
    };
  }

  if (!requiresVerification(program)) {
    if (effectiveStatus === "completed" || effectiveStatus === "expiring_soon") {
      return {
        step: effectiveStatus === "expiring_soon" ? "expiring_soon" : "fully_certified",
        phase: "certified",
        tag: effectiveStatus === "expiring_soon" ? "Expiring" : "Complete",
        detail: "Acknowledgement-based completion",
        part1Complete: true,
        fullyCertified: true,
        needsWorkerAction: effectiveStatus === "expiring_soon",
      };
    }
    return {
      step: ack ? "acknowledged" : read ? "read" : "not_started",
      phase: "part1",
      tag: ack ? "Acknowledged" : read ? "Read" : "Not started",
      detail: ack ? "Awaiting completion" : read ? "Acknowledge to continue" : "Open the procedure",
      part1Complete: false,
      fullyCertified: false,
      needsWorkerAction: !ack,
    };
  }

  if (quizPass && !signoff) {
    return {
      step: "shadow_pending",
      phase: "part2",
      tag: "Part 1 done",
      detail: "Online training complete — awaiting shadow shift & supervisor sign-off",
      part1Complete: true,
      fullyCertified: false,
      needsWorkerAction: false,
    };
  }

  if (effectiveStatus === "quiz_failed" || (attempts > 0 && !quizPass && ack)) {
    const scoreNote = latestScore != null ? ` · last score ${latestScore}%` : "";
    const attemptNote = attempts > 0 ? ` · ${attempts} attempt${attempts === 1 ? "" : "s"}` : "";
    return {
      step: "quiz_retry",
      phase: "part1",
      tag: "Quiz retry",
      detail: `Knowledge check — 100% required${attemptNote}${scoreNote}`,
      part1Complete: false,
      fullyCertified: false,
      needsWorkerAction: true,
    };
  }

  if (ack && !quizPass) {
    return {
      step: "acknowledged",
      phase: "part1",
      tag: "Acknowledged",
      detail: "Complete the knowledge check (100% to finish Part 1)",
      part1Complete: false,
      fullyCertified: false,
      needsWorkerAction: true,
    };
  }

  if (read && !ack) {
    return {
      step: "read",
      phase: "part1",
      tag: "Read",
      detail: "Sign acknowledgement to continue Part 1",
      part1Complete: false,
      fullyCertified: false,
      needsWorkerAction: true,
    };
  }

  if (effectiveStatus === "in_progress") {
    return {
      step: "read",
      phase: "part1",
      tag: "Read",
      detail: "Procedure opened — acknowledge when finished reading",
      part1Complete: false,
      fullyCertified: false,
      needsWorkerAction: true,
    };
  }

  return {
    step: "not_started",
    phase: "part1",
    tag: "Not started",
    detail: "Open the procedure to begin Part 1 (read → acknowledge → quiz)",
    part1Complete: false,
    fullyCertified: false,
    needsWorkerAction: true,
  };
}

export function flowStepSortRank(step: TrainingFlowStepId): number {
  const order: TrainingFlowStepId[] = [
    "expired",
    "revision_pending",
    "quiz_retry",
    "not_started",
    "read",
    "acknowledged",
    "shadow_pending",
    "part1_complete",
    "expiring_soon",
    "fully_certified",
    "not_applicable",
  ];
  const i = order.indexOf(step);
  return i === -1 ? 50 : i;
}
