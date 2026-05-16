import { describe, expect, it } from "vitest";
import {
  getDepartmentAccessibleFeatures,
  readAccessSnapshot,
  snapshotIsUnassigned,
} from "@/lib/access-snapshot";
import type { PulseAuthSession } from "@/lib/pulse-session";

describe("access-snapshot", () => {
  it("comms module route allowed when snapshot grants feature", () => {
    const snap = {
      department: "communications",
      matrix_slot: "coordination",
      features: ["comms_publication_builder"],
      capabilities: ["publication_pipeline.view"],
      departments: ["communications"],
      is_company_admin: false,
    };
    expect(getDepartmentAccessibleFeatures("communications", snap)).toContain("comms_publication_builder");
  });

  it("denies communications modules without HR department membership", () => {
    const snap = {
      department: "maintenance",
      matrix_slot: "team_member",
      features: ["comms_publication_builder"],
      capabilities: ["publication_pipeline.view"],
      departments: ["maintenance"],
      is_company_admin: false,
    };
    expect(getDepartmentAccessibleFeatures("communications", snap)).toEqual([]);
  });

  it("legacy session synthesizes snapshot from enabled_features", () => {
    const session = {
      enabled_features: ["inventory"],
      rbac_permissions: ["inventory.view"],
      hr_department: "maintenance",
    } as PulseAuthSession;
    const snap = readAccessSnapshot(session);
    expect(snap?.features).toContain("inventory");
    expect(snap?.assignment_status).toBe("unassigned");
    expect(snap?.matrix_slot).toBe("unassigned");
    expect(snap?.audit?.assignment_status).toBe("unassigned");
    expect(snapshotIsUnassigned(snap)).toBe(true);
    expect(snap?.audit?.resolution_warnings?.some((w) => w.includes("access_snapshot"))).toBe(true);
  });
});
