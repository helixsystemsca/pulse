import { describe, expect, it } from "vitest";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { routeOpsAsk } from "@/lib/search/ops-ask-router";

const VERNON_FEATURES = [
  "dashboard",
  "dashboard_leadership",
  "dashboard_operations",
  "recreation_ops",
  "equipment",
  "logs_inspections",
  "work_requests",
  "inventory",
  "schedule",
  "procedures",
  "standards_training",
  "standards_compliance",
  "projects",
  "project_management",
  "qr_codes",
  "messaging",
];

function vernonAdmin(partial: Partial<PulseAuthSession> = {}): PulseAuthSession {
  return {
    sub: "josh",
    email: "josh@vernon.ca",
    iat: 0,
    exp: 9999999999,
    remember: false,
    role: "company_admin",
    roles: ["company_admin"],
    facility_tenant_admin: true,
    contract_features: VERNON_FEATURES,
    enabled_features: VERNON_FEATURES,
    rbac_permissions: ["*"],
    ...partial,
  };
}

function topHref(query: string, session: PulseAuthSession = vernonAdmin()): string | undefined {
  return routeOpsAsk(query, session).results[0]?.href;
}

function hrefs(query: string, session: PulseAuthSession = vernonAdmin()): string[] {
  return routeOpsAsk(query, session).results.map((r) => r.href);
}

describe("routeOpsAsk — intent to route", () => {
  it("maps “Where do I add a PM for the ice plant?” to equipment with a search deep-link", () => {
    const answer = routeOpsAsk("Where do I add a PM for the ice plant?", vernonAdmin());
    expect(answer.matched).toBe(true);
    expect(topHref("Where do I add a PM for the ice plant?")).toBe("/equipment?q=ice%20plant");
    expect(answer.results[0]?.howTo?.toLowerCase()).toMatch(/preventive maintenance|add pm/);
  });

  it("maps “How do I start a pool seasonal checklist?” to seasonal checklists", () => {
    expect(topHref("How do I start a pool seasonal checklist?")).toBe("/recreation/checklists?category=seasonal");
  });

  it("maps “Where are contractor insurance expiries?” to contractors", () => {
    expect(topHref("Where are contractor insurance expiries?")).toBe("/recreation/contractors");
  });

  it("maps “Create a work request from a failed inspection” to inspections", () => {
    expect(topHref("Create a work request from a failed inspection?")).toBe("/dashboard/compliance");
    expect(hrefs("Create a work request from a failed inspection")).toEqual(
      expect.arrayContaining(["/dashboard/compliance"]),
    );
  });

  it("maps “Show ammonia emergency procedure” to emergency response", () => {
    const answer = routeOpsAsk("Show ammonia emergency procedure", vernonAdmin());
    expect(answer.matched).toBe(true);
    expect(topHref("Show ammonia emergency procedure")).toBe("/recreation/emergency");
    expect(answer.copilotPromptId).toBe("ammonia-release");
    expect(hrefs("Show ammonia emergency procedure").some((h) => h.startsWith("/recreation/copilot"))).toBe(true);
  });

  it("fuzzy-matches authorized nav labels", () => {
    const answer = routeOpsAsk("inventory stock", vernonAdmin(), [
      { label: "Inventory", href: "/dashboard/inventory" },
      { label: "Schedule", href: "/schedule" },
    ]);
    expect(answer.results.some((r) => r.href === "/dashboard/inventory")).toBe(true);
  });

  it("does not promote disabled modules as primary hits", () => {
    const noRecOps = vernonAdmin({
      enabled_features: VERNON_FEATURES.filter((f) => f !== "recreation_ops"),
      contract_features: VERNON_FEATURES.filter((f) => f !== "recreation_ops"),
    });
    const seasonal = routeOpsAsk("How do I start a pool seasonal checklist?", noRecOps);
    expect(seasonal.results.some((r) => r.href.includes("/recreation/checklists"))).toBe(false);
    expect(seasonal.fallbacks.some((r) => r.href.includes("/recreation/attention"))).toBe(false);

    const noEquipment = vernonAdmin({
      enabled_features: VERNON_FEATURES.filter((f) => f !== "equipment"),
      contract_features: VERNON_FEATURES.filter((f) => f !== "equipment"),
    });
    const pm = routeOpsAsk("Where do I add a PM for the ice plant?", noEquipment);
    expect(pm.results.some((r) => (r.href.split("?")[0] ?? r.href) === "/equipment")).toBe(false);
  });

  it("maps regulatory questions onto Codes & Guidance", () => {
    const cases: Array<[string, string]> = [
      ["chief engineer responsibilities", "/recreation/regulations"],
      ["interior health pool code", "/recreation/regulations"],
      ["building code", "/recreation/regulations"],
      ["oh&s", "/recreation/regulations"],
      ["refrigeration plant requirements", "/recreation/regulations"],
    ];
    for (const [query, hrefBase] of cases) {
      const answer = routeOpsAsk(query, vernonAdmin());
      expect(answer.matched, query).toBe(true);
      expect((topHref(query) ?? "").split("?")[0], query).toBe(hrefBase);
    }
    expect(routeOpsAsk("oh&s", vernonAdmin()).copilotPromptId).toBe("ohs-worksafebc");
    expect(routeOpsAsk("building code", vernonAdmin()).copilotPromptId).toBe("building-code");
    expect((topHref("refrigeration operator") ?? "").split("?")[0]).toBe("/recreation/regulations");
    expect((topHref("ammonia safety order") ?? "").split("?")[0]).toBe("/recreation/regulations");
    expect((topHref("ammonia") ?? "").split("?")[0]).toBe("/recreation/regulations");
    expect((topHref("tsbc") ?? "").split("?")[0]).toBe("/recreation/regulations");
    expect((topHref("ice plant") ?? "").split("?")[0]).toBe("/recreation/regulations");
    expect((topHref("chief engineer") ?? "").split("?")[0]).toBe("/recreation/regulations");
    expect((topHref("secondary coolant") ?? "").split("?")[0]).toBe("/recreation/regulations");
  });

  it("still sends ammonia emergency to Emergency Response, not the library as primary", () => {
    expect(topHref("Show ammonia emergency procedure")).toBe("/recreation/emergency");
    expect(topHref("ammonia release")).toBe("/recreation/emergency");
  });

  it("sends ammonia plant-rule questions to Codes & Guidance, not Emergency Response", () => {
    expect((topHref("ammonia safety order") ?? "").split("?")[0]).toBe("/recreation/regulations");
    expect((topHref("refrigeration operator") ?? "").split("?")[0]).toBe("/recreation/regulations");
    expect((topHref("chief engineer responsibilities") ?? "").split("?")[0]).toBe("/recreation/regulations");
    expect((topHref("ammonia") ?? "").split("?")[0]).toBe("/recreation/regulations");
    expect((topHref("ice plant") ?? "").split("?")[0]).toBe("/recreation/regulations");
    expect((topHref("tsbc") ?? "").split("?")[0]).toBe("/recreation/regulations");
  });

  it("maps “add facility” to the facility create screen", () => {
    expect(topHref("add facility")).toBe("/recreation/facilities?create=1");
    expect(topHref("Add a facility")).toBe("/recreation/facilities?create=1");
  });

  it("maps “assets at the arena” to the equipment list", () => {
    expect(topHref("assets at the arena")).toBe("/equipment?q=arena");
    expect(topHref("equipment at arena")).toBe("/equipment?q=arena");
  });

  it("maps “inventory at the pool” to inventory", () => {
    expect(topHref("inventory at the pool")).toBe("/dashboard/inventory?q=pool");
    expect(topHref("inventory at pool")).toBe("/dashboard/inventory?q=pool");
  });

  it("maps “what's at the arena” to the facilities list", () => {
    expect((topHref("what's at the arena") ?? "").startsWith("/recreation/facilities")).toBe(true);
  });

  it("says so when nothing matches and suggests high-value browse destinations", () => {
    const answer = routeOpsAsk("blarghxyz not a real module 999", vernonAdmin());
    expect(answer.matched).toBe(false);
    expect(answer.results).toEqual([]);
    expect(answer.summary).toMatch(/nothing matched/i);
    const fallbackHrefs = answer.fallbacks.map((r) => r.href);
    expect(fallbackHrefs).toEqual(
      expect.arrayContaining([
        "/overview",
        "/equipment",
        "/dashboard/compliance",
        "/training/learning/library",
        "/recreation/attention",
      ]),
    );
    expect(answer.fallbacks.length).toBeGreaterThanOrEqual(3);
    expect(answer.fallbacks.length).toBeLessThanOrEqual(5);
  });
});
