import { describe, expect, it } from "vitest";
import {
  isRoutineAssignmentWorkforceRole,
  isRoutineAssignmentWorkforceWorker,
} from "@/lib/schedule/routine-workforce-roles";

describe("routine-workforce-roles", () => {
  it("allows worker and lead", () => {
    expect(isRoutineAssignmentWorkforceRole("worker")).toBe(true);
    expect(isRoutineAssignmentWorkforceRole("lead")).toBe(true);
  });

  it("excludes manager and supervisor", () => {
    expect(isRoutineAssignmentWorkforceRole("manager")).toBe(false);
    expect(isRoutineAssignmentWorkforceRole("supervisor")).toBe(false);
    expect(isRoutineAssignmentWorkforceWorker({ role: "manager" })).toBe(false);
  });
});
