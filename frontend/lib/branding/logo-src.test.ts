import { describe, expect, it } from "vitest";

import {
  isApiRelativeLogoUrl,
  isDirectDisplayLogoUrl,
  isHttpsLogoUrl,
  isPublicStaticLogoUrl,
  trimLogoUrl,
} from "@/lib/branding/logo-src";

describe("logo-src", () => {
  it("classifies https, static, and API logo URLs", () => {
    expect(isHttpsLogoUrl("https://cdn.example/logo.png")).toBe(true);
    expect(isPublicStaticLogoUrl("/images/city-of-vernon-logo.png")).toBe(true);
    expect(isApiRelativeLogoUrl("/api/v1/company/logo")).toBe(true);
    expect(isDirectDisplayLogoUrl("https://cdn.example/logo.png")).toBe(true);
    expect(isDirectDisplayLogoUrl("/images/city-of-vernon-logo.png")).toBe(true);
    expect(isDirectDisplayLogoUrl("/api/v1/company/logo")).toBe(false);
  });

  it("trims empty logo URLs to null", () => {
    expect(trimLogoUrl("  /images/city-of-vernon-logo.png ")).toBe("/images/city-of-vernon-logo.png");
    expect(trimLogoUrl("")).toBeNull();
    expect(trimLogoUrl(null)).toBeNull();
  });
});
