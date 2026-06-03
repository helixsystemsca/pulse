import { describe, expect, it } from "vitest";
import { formatTourWelcomeLine } from "@/lib/onboarding/tour-welcome";

describe("formatTourWelcomeLine", () => {
  it("prefixes feature labels", () => {
    expect(formatTourWelcomeLine("Schedule")).toBe("Welcome to Schedule");
  });

  it("keeps titles that already start with Welcome", () => {
    expect(formatTourWelcomeLine("Welcome to Helix")).toBe("Welcome to Helix");
  });
});
