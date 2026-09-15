import { describe, expect, it } from "vitest";

import {
  canonicalPublicLogoUrl,
  isApiRelativeLogoUrl,
  isDirectDisplayLogoUrl,
  isHttpsLogoUrl,
  isPublicStaticLogoUrl,
  isStaticSvgLogoUrl,
  isVernonStaticLogoUrl,
  trimLogoUrl,
} from "@/lib/branding/logo-src";
import {
  CITY_OF_VERNON_LOGO_PNG_SRC,
  CITY_OF_VERNON_LOGO_SRC,
} from "@/lib/branding/platform-defaults";

describe("logo-src", () => {
  it("classifies https, static, and API logo URLs", () => {
    expect(isHttpsLogoUrl("https://cdn.example/logo.png")).toBe(true);
    expect(isPublicStaticLogoUrl("/images/city-of-vernon-logo.png")).toBe(true);
    expect(isPublicStaticLogoUrl(CITY_OF_VERNON_LOGO_SRC)).toBe(true);
    expect(isApiRelativeLogoUrl("/api/v1/company/logo")).toBe(true);
    expect(isDirectDisplayLogoUrl("https://cdn.example/logo.png")).toBe(true);
    expect(isDirectDisplayLogoUrl("/images/city-of-vernon-logo.png")).toBe(true);
    expect(isDirectDisplayLogoUrl(CITY_OF_VERNON_LOGO_SRC)).toBe(true);
    expect(isDirectDisplayLogoUrl("/api/v1/company/logo")).toBe(false);
  });

  it("trims empty logo URLs to null", () => {
    expect(trimLogoUrl("  /images/city-of-vernon-logo.png ")).toBe("/images/city-of-vernon-logo.png");
    expect(trimLogoUrl("")).toBeNull();
    expect(trimLogoUrl(null)).toBeNull();
  });

  it("canonicalizes the Vernon PNG seed onto the transparent SVG", () => {
    expect(isStaticSvgLogoUrl(CITY_OF_VERNON_LOGO_SRC)).toBe(true);
    expect(isVernonStaticLogoUrl(CITY_OF_VERNON_LOGO_SRC)).toBe(true);
    expect(isVernonStaticLogoUrl(CITY_OF_VERNON_LOGO_PNG_SRC)).toBe(true);
    expect(canonicalPublicLogoUrl(CITY_OF_VERNON_LOGO_PNG_SRC)).toBe(CITY_OF_VERNON_LOGO_SRC);
    expect(canonicalPublicLogoUrl(CITY_OF_VERNON_LOGO_SRC)).toBe(CITY_OF_VERNON_LOGO_SRC);
    expect(canonicalPublicLogoUrl("/api/v1/company/logo")).toBe("/api/v1/company/logo");
    expect(canonicalPublicLogoUrl("https://cdn.example/custom.png")).toBe("https://cdn.example/custom.png");
  });
});
