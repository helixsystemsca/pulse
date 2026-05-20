import { describe, expect, it } from "vitest";
import {
  formatMatrixSlotOperationalLabel,
  formatSlotSourceLabel,
  isUnresolvedMatrixSlot,
  matrixSlotSourceKind,
} from "@/lib/rbac/matrix-slot-policy";

describe("matrix-slot-policy", () => {
  it("formats operational label without source suffix", () => {
    expect(formatMatrixSlotOperationalLabel("operations", "maintenance")).toBe("Operations");
  });

  it("labels department baseline source", () => {
    expect(formatSlotSourceLabel("department_baseline")).toBe("Department default");
  });

  it("maps baseline kind", () => {
    expect(matrixSlotSourceKind("department_baseline")).toBe("baseline");
  });

  it("flags unresolved", () => {
    expect(isUnresolvedMatrixSlot("unresolved", "unresolved")).toBe(true);
  });
});
