import { describe, expect, it } from "vitest";
import type { PulseAuthSession } from "@/lib/pulse-session";
import {
  canAccessSpatialWorkspace,
  listAccessibleSpatialWorkspaces,
  resolveDefaultSpatialWorkspace,
} from "@/spatial-engine/workspace/access";

function session(partial: Partial<PulseAuthSession>): PulseAuthSession {
  return {
    user_id: "u1",
    email: "test@example.com",
    role: "worker",
    enabled_features: [],
    rbac_permissions: [],
    ...partial,
  } as PulseAuthSession;
}

describe("spatial workspace access", () => {
  it("grants infrastructure when drawings RBAC matches", () => {
    const s = session({
      enabled_features: ["drawings"],
      contract_features: ["drawings"],
      rbac_permissions: ["drawings.view"],
    });
    expect(canAccessSpatialWorkspace(s, "infrastructure")).toBe(true);
    expect(canAccessSpatialWorkspace(s, "advertising")).toBe(false);
  });

  it("grants advertising when arena advertising RBAC matches", () => {
    const s = session({
      enabled_features: ["advertising_mapper"],
      contract_features: ["advertising_mapper"],
      rbac_permissions: ["arena_advertising.view"],
    });
    expect(canAccessSpatialWorkspace(s, "advertising")).toBe(true);
  });

  it("defaults to requested workspace when permitted", () => {
    const s = session({
      enabled_features: ["drawings", "advertising_mapper"],
      contract_features: ["drawings", "advertising_mapper"],
      rbac_permissions: ["drawings.view", "arena_advertising.view"],
    });
    expect(resolveDefaultSpatialWorkspace(s, "advertising")).toBe("advertising");
    expect(listAccessibleSpatialWorkspaces(s).map((w) => w.id)).toContain("infrastructure");
    expect(listAccessibleSpatialWorkspaces(s).map((w) => w.id)).toContain("advertising");
  });
});
