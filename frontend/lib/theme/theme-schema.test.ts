import { describe, expect, it } from "vitest";
import { normalizeOrganizationTheme } from "@/lib/theme/theme-schema";

describe("normalizeOrganizationTheme", () => {
  it("normalizes nested brand and semantic tokens", () => {
    const t = normalizeOrganizationTheme({
      brand: { primary: "#112233", secondary: "#445566", accent: "#778899", hover: "#aabbcc", surface: "#ddeeff" },
      semantic: { success: "#1ea896", warning: "#c9932e", critical: "#f6511d" },
    });
    expect(t.brand.primary).toBe("#112233");
    expect(t.semantic.critical).toBe("#f6511d");
  });

  it("migrates legacy flat shape with danger -> critical", () => {
    const t = normalizeOrganizationTheme({
      primary: "#0ea5e9",
      secondary: "#4c5454",
      accent: "#38bdf8",
      success: "#1ea896",
      warning: "#c9932e",
      danger: "#f6511d",
    });
    expect(t.brand.primary).toBe("#0ea5e9");
    expect(t.semantic.critical).toBe("#f6511d");
    expect(t.brand.hover).toBeTruthy();
    expect(t.brand.surface).toBeTruthy();
  });
});
