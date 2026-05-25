import { describe, expect, it } from "vitest";
import { deriveTrainingFlowState } from "@/lib/training/trainingFlow";
import type { TrainingAssignment, TrainingProgram } from "@/lib/training/types";

const program: TrainingProgram = {
  id: "tp-test",
  title: "Test SOP",
  description: "",
  tier: "mandatory",
  program_type: "procedure",
  category: "General",
  department_category: "",
  revision_number: 2,
  revision_date: "2026-01-01",
  requires_acknowledgement: true,
  requires_knowledge_verification: true,
  expiry_months: 12,
  active: true,
};

function assign(partial: Partial<TrainingAssignment>): TrainingAssignment {
  return {
    id: "ta-1",
    employee_id: "emp-1",
    training_program_id: program.id,
    assigned_by: null,
    assigned_date: "2026-01-01",
    due_date: null,
    status: "pending",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
    ...partial,
  };
}

describe("deriveTrainingFlowState", () => {
  it("tracks read before acknowledge", () => {
    const state = deriveTrainingFlowState({
      program,
      assignment: assign({
        verification_first_viewed_at: "2026-05-01T10:00:00Z",
      }),
      latestAck: undefined,
      effectiveStatus: "in_progress",
    });
    expect(state.tag).toBe("Read");
    expect(state.part1Complete).toBe(false);
  });

  it("marks Part 1 complete when quiz passed without sign-off", () => {
    const state = deriveTrainingFlowState({
      program,
      assignment: assign({
        quiz_passed_at: "2026-05-02T12:00:00Z",
        quiz_attempt_count: 2,
        quiz_latest_score_percent: 100,
        quiz_latest_passed: true,
      }),
      latestAck: {
        id: "ack-1",
        employee_id: "emp-1",
        training_program_id: program.id,
        revision_number: 2,
        acknowledged_at: "2026-05-01T11:00:00Z",
      },
      effectiveStatus: "pending",
    });
    expect(state.step).toBe("shadow_pending");
    expect(state.part1Complete).toBe(true);
    expect(state.fullyCertified).toBe(false);
  });

  it("requires supervisor sign-off for fully certified", () => {
    const state = deriveTrainingFlowState({
      program,
      assignment: assign({
        quiz_passed_at: "2026-05-02T12:00:00Z",
        supervisor_signoff: true,
        completed_date: "2026-05-03T09:00:00Z",
      }),
      latestAck: {
        id: "ack-1",
        employee_id: "emp-1",
        training_program_id: program.id,
        revision_number: 2,
        acknowledged_at: "2026-05-01T11:00:00Z",
      },
      effectiveStatus: "completed",
    });
    expect(state.fullyCertified).toBe(true);
    expect(state.tag).toBe("Certified");
  });
});
