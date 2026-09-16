import { describe, expect, it } from "vitest";
import { isPulseNavActive } from "@/lib/pulse-nav-active";

describe("isPulseNavActive — hub prefixes after sidebar collapse", () => {
  it("highlights Team Management hub for nested manager routes", () => {
    expect(isPulseNavActive("/team-management", "/team-management")).toBe(true);
    expect(isPulseNavActive("/team-management", "/team-management/people")).toBe(true);
    expect(isPulseNavActive("/team-management", "/team-management/meetings/one-on-ones")).toBe(true);
  });

  it("highlights Projects hub for roadmap and PM tool routes", () => {
    expect(isPulseNavActive("/projects", "/projects")).toBe(true);
    expect(isPulseNavActive("/projects", "/roadmap")).toBe(true);
    expect(isPulseNavActive("/projects", "/project-management")).toBe(true);
    expect(isPulseNavActive("/projects", "/planning")).toBe(true);
  });

  it("highlights ops People for the org-chart tab", () => {
    expect(isPulseNavActive("/recreation/people", "/recreation/people")).toBe(true);
    expect(isPulseNavActive("/recreation/people", "/recreation/org-chart")).toBe(true);
    expect(isPulseNavActive("/recreation/people", "/recreation/contacts")).toBe(false);
  });
});
