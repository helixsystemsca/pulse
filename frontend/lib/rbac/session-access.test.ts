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
  it("allows communications modules when contract uses legacy keys", () => {
    const s = session({
      contract_features: ["comms_advertising_mapper", "comms_publication_builder"],
      enabled_features: ["advertising_mapper", "comms_publication_builder"],
      rbac_permissions: ["arena_advertising.view", "publication_pipeline.view"],
    });
    expect(canAccessClassicNavHref(s, "/communications/advertising-mapper")).toBe(true);
    expect(canAccessClassicNavHref(s, "/communications/publication-builder")).toBe(true);
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
    expect(items.some((i) => i.href === "/communications/advertising-mapper")).toBe(true);
  });
});
