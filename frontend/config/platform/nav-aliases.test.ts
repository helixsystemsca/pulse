import { describe, expect, it } from "vitest";
import { NAV_ROUTE_ALIASES, resolveNavRouteAlias } from "@/config/platform/nav-aliases";

describe("nav-aliases", () => {
  it("maps legacy maintenance dashboard paths to canonical routes", () => {
    expect(NAV_ROUTE_ALIASES["/dashboard/maintenance/inspections"]).toBe("/dashboard/compliance");
    expect(resolveNavRouteAlias("/dashboard/procedures")).toBe("/standards/procedures");
  });
});
