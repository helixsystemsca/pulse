import { describe, expect, it } from "vitest";
import type { PulseAuthSession } from "@/lib/pulse-session";
import {
  canAccessClassicNavHref,
  tenantHasAnyCompanyModule,
  tenantSidebarNavItemsForLiveApp,
} from "@/lib/rbac/session-access";

function session(partial: Partial<PulseAuthSession>): PulseAuthSession {
  return {
    sub: "u1",
    email: "u@test.com",
    iat: 0,
    exp: 9999999999,
    remember: false,
    ...partial,
  };
}

describe("tenantHasAnyCompanyModule", () => {
  it("accepts legacy contract keys for canonical module ids", () => {
    const s = session({
      contract_features: ["comms_advertising_mapper", "comms_indesign_pipeline"],
    });
    expect(tenantHasAnyCompanyModule(s, ["advertising_mapper"])).toBe(true);
    expect(tenantHasAnyCompanyModule(s, ["xplor_indesign"])).toBe(true);
  });
});

describe("canAccessClassicNavHref", () => {
  it("allows /drawings when only arena advertising is granted", () => {
    const s = session({
      contract_features: ["comms_advertising_mapper"],
      enabled_features: ["comms_advertising_mapper"],
      rbac_permissions: ["arena_advertising.view"],
    });
    expect(canAccessClassicNavHref(s, "/drawings")).toBe(true);
    expect(canAccessClassicNavHref(s, "/drawings?workspace=advertising")).toBe(true);
  });

  it("denies training compliance and archive to workers; allows supervision roles", () => {
    const worker = session({
      contract_features: ["procedures", "standards_compliance"],
      enabled_features: ["procedures", "standards_compliance", "standards_training"],
      rbac_permissions: ["procedures.view", "standards.compliance.view", "standards.training.compliance.view"],
      roles: ["worker"],
    });
    expect(canAccessClassicNavHref(worker, "/training/compliance/matrix")).toBe(false);
    expect(canAccessClassicNavHref(worker, "/training/learning/archive")).toBe(false);
    expect(canAccessClassicNavHref(worker, "/training/learning/my-learning")).toBe(true);

    const supervisor = session({
      ...worker,
      roles: ["supervisor"],
    });
    expect(canAccessClassicNavHref(supervisor, "/training/compliance/matrix")).toBe(true);
    expect(canAccessClassicNavHref(supervisor, "/training/learning/archive")).toBe(true);
  });

  it("allows communications modules when contract uses legacy keys", () => {
    const s = session({
      contract_features: ["comms_advertising_mapper", "comms_indesign_pipeline"],
      enabled_features: ["advertising_mapper", "xplor_indesign"],
      rbac_permissions: ["arena_advertising.view", "xplor_indesign.view"],
    });
    expect(canAccessClassicNavHref(s, "/drawings?workspace=advertising")).toBe(true);
    expect(canAccessClassicNavHref(s, "/communications/indesign-pipeline")).toBe(true);
  });
});

describe("tenantSidebarNavItemsForLiveApp", () => {
  it("includes arena advertising when registry and route gate both pass", () => {
    const items = tenantSidebarNavItemsForLiveApp(
      session({
        contract_features: ["comms_advertising_mapper", "schedule"],
        enabled_features: ["advertising_mapper", "schedule"],
        rbac_permissions: ["arena_advertising.view", "schedule.view"],
      }),
    );
    expect(items.some((i) => i.href === "/drawings?workspace=advertising")).toBe(true);
  });
});
