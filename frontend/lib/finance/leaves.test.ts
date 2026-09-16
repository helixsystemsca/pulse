import { describe, expect, it } from "vitest";
import { MASTER_FEATURES } from "@/config/platform/master-feature-registry";
import { FINANCE_LEAVES, leafFromPath } from "@/lib/finance/leaves";

describe("finance leaves", () => {
  it("maps Josh’s tree slugs onto titled pages", () => {
    expect(leafFromPath(undefined).title).toBe("Financial & Asset Planning");
    expect(leafFromPath(["dashboard"]).title).toBe("Budget Dashboard");
    expect(leafFromPath(["capital", "projects"]).title).toBe("Capital · Projects");
    expect(leafFromPath(["planner", "next-year"]).title).toBe("Next Year builder");
    expect(leafFromPath(["opportunities"]).title).toBe("Budget Opportunities");
  });

  it("keeps registry routes aligned with leaf slugs", () => {
    const nav = MASTER_FEATURES.filter((f) => f.feature === "finance_asset_planning");
    const routes = nav.map((f) => f.route.replace("/finance/", "")).sort();
    expect(routes).toEqual(Object.keys(FINANCE_LEAVES).sort());
    expect(nav.find((f) => f.key === "finance_capital_projects")?.label).toBe("Capital projects");
  });
});
