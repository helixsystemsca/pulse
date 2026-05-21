import { describe, expect, it } from "vitest";
import { evaluateRoutineAssignmentEligibility, routineItemsForShiftBand } from "./routine-eligibility";
import type { RoutineDetail } from "@/lib/routinesService";
import type { Shift, Worker } from "@/lib/schedule/types";
import type { TrainingProgram } from "@/lib/training/types";

const worker: Worker = {
  id: "w1",
  name: "Alex",
  role: "worker",
  active: true,
  certifications: ["P1"],
};

const shift: Shift = {
  id: "s1",
  workerId: "w1",
  date: "2026-05-18",
  startTime: "08:00",
  endTime: "16:00",
  shiftType: "day",
  zoneId: "z1",
  role: "worker",
  eventType: "work",
  shiftKind: "workforce",
  required_certifications: ["P2"],
};

const routine: RoutineDetail = {
  id: "r1",
  company_id: "c1",
  name: "Pool open",
  created_at: "",
  updated_at: "",
  items: [
    {
      id: "i1",
      company_id: "c1",
      routine_id: "r1",
      label: "Test water",
      position: 0,
      required: true,
      procedure_id: "tp-pool-chem",
      created_at: "",
      updated_at: "",
    },
  ],
};

const program: TrainingProgram = {
  id: "tp-pool-chem",
  title: "Pool Chemical Handling",
  description: "",
  tier: "high_risk",
  program_type: "course",
  category: "Chemicals",
  department_category: "aquatics",
  revision_number: 1,
  revision_date: "2026-01-01",
  requires_acknowledgement: true,
  expiry_months: 12,
  active: true,
};

describe("routineItemsForShiftBand", () => {
  it("keeps unscoped items and matching band only", () => {
    const items = routine.items.concat({
      ...routine.items[0]!,
      id: "i2",
      shift_band: "night",
      label: "Night only",
    });
    const day = routineItemsForShiftBand(items, "day");
    expect(day.map((i) => i.id)).toEqual(["i1"]);
  });
});

describe("evaluateRoutineAssignmentEligibility", () => {
  it("flags missing shift certification", () => {
    const r = evaluateRoutineAssignmentEligibility(worker, shift, routine, {
      programs: [program],
      assignments: [],
      acknowledgements: [],
    });
    expect(r.eligible).toBe(false);
    expect(r.tone).toBe("invalid");
    expect(r.tooltip).toMatch(/Pool Operator|shift/i);
  });

  it("allows when certs and training are satisfied", () => {
    const okShift: Shift = { ...shift, required_certifications: ["P1"] };
    const r = evaluateRoutineAssignmentEligibility(worker, okShift, routine, {
      programs: [program],
      assignments: [
        {
          id: "a1",
          employee_id: "w1",
          training_program_id: "tp-pool-chem",
          assigned_by: null,
          assigned_date: "2026-01-01",
          due_date: null,
          status: "completed",
          completed_date: "2026-02-01",
          expiry_date: "2027-02-01",
          acknowledgement_date: null,
          supervisor_signoff: false,
        },
      ],
      acknowledgements: [],
    });
    expect(r.eligible).toBe(true);
    expect(r.tone).toBe("good");
  });
});
