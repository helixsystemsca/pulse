import { describe, expect, it } from "vitest";
import type { Shift, Worker } from "@/lib/schedule/types";
import {
  buildWorkerCredentialState,
  evaluateAssignmentTraining,
  evaluateShiftAssignmentAlarms,
  normalizeCredentialCode,
  parseCertRequirements,
} from "./assignment-eligibility";

const worker = (patch: Partial<Worker> = {}): Worker => ({
  id: "w1",
  name: "Alex",
  role: "worker",
  active: true,
  certifications: [],
  ...patch,
});

const shift = (patch: Partial<Shift> = {}): Shift => ({
  id: "s1",
  workerId: "w1",
  date: "2026-09-15",
  startTime: "08:00",
  endTime: "16:00",
  shiftType: "day",
  zoneId: "pool",
  role: "worker",
  eventType: "work",
  shiftKind: "workforce",
  ...patch,
});

describe("normalizeCredentialCode", () => {
  it("maps HR names to canonical codes", () => {
    expect(normalizeCredentialCode("pool operator level 1")).toBe("P1");
    expect(normalizeCredentialCode("First Aid")).toBe("FA");
  });
});

describe("parseCertRequirements", () => {
  it("accepts strings and facility-scoped objects", () => {
    const reqs = parseCertRequirements(["P1", { code: "FA", facility_id: "fac-1" }]);
    expect(reqs).toEqual([
      { code: "P1", facilityId: null },
      { code: "FA", facilityId: "fac-1" },
    ]);
  });
});

describe("evaluateAssignmentTraining", () => {
  it("alarms when required training is missing", () => {
    const state = buildWorkerCredentialState(worker({ certifications: ["FA"] }));
    const alarms = evaluateAssignmentTraining(parseCertRequirements(["P1", "FA"]), state);
    expect(alarms).toHaveLength(1);
    expect(alarms[0]?.code).toBe("training_missing");
    expect(alarms[0]?.label).toMatch(/Pool Operator Level 1/);
  });

  it("alarms when the only matching cert is expired", () => {
    const state = buildWorkerCredentialState(
      worker({
        certifications: ["P1"],
        certificationRecords: [{ name: "P1", status: "expired", expiryDate: "2020-01-01" }],
      }),
    );
    expect(state.qualified.has("P1")).toBe(false);
    const alarms = evaluateAssignmentTraining(parseCertRequirements(["P1"]), state);
    expect(alarms[0]?.code).toBe("training_expired");
  });

  it("treats completed training names as competency", () => {
    const state = buildWorkerCredentialState(worker({ completedTraining: ["Pool Operator Level 1"] }));
    expect(evaluateAssignmentTraining(parseCertRequirements(["P1"]), state)).toEqual([]);
  });

  it("only applies facility-scoped requirements at that facility", () => {
    const state = buildWorkerCredentialState(worker());
    const reqs = parseCertRequirements([{ code: "P1", facility_id: "pool" }]);
    expect(evaluateAssignmentTraining(reqs, state, { facilityId: "arena" })).toEqual([]);
    const here = evaluateAssignmentTraining(reqs, state, { facilityId: "pool" });
    expect(here[0]?.code).toBe("training_missing");
    expect(here[0]?.label).toMatch(/facility/i);
  });
});

describe("evaluateShiftAssignmentAlarms", () => {
  it("uses shift-definition cert_requirements when the shift has none stored", () => {
    const alarms = evaluateShiftAssignmentAlarms(
      shift({ required_certifications: undefined, shiftCode: "D2" }),
      worker({ certifications: [] }),
      [{ id: "def-1", code: "D2", cert_requirements: ["P1"] }],
    );
    expect(alarms[0]?.code).toBe("training_missing");
  });

  it("is clean when the worker holds every required code", () => {
    const alarms = evaluateShiftAssignmentAlarms(
      shift({ required_certifications: ["P1", "FA"] }),
      worker({ certifications: ["P1", "FA"] }),
    );
    expect(alarms).toEqual([]);
  });
});
