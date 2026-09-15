import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CITY_OF_VERNON_LOGO_SRC,
  PLATFORM_DEFAULT_LOGO_SRC,
} from "@/lib/branding/platform-defaults";
import {
  isCityOfVernonCompanyName,
  isVernonAppHostname,
  resolveAuthBrand,
  resolveAuthModalBrand,
  shouldUseVernonAuthBrand,
} from "@/lib/branding/auth-brand";

describe("auth-brand", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("recognizes the Vernon app host", () => {
    expect(isVernonAppHostname("vernon.helixsystems.ca")).toBe(true);
    expect(isVernonAppHostname("VERNON.helixsystems.ca")).toBe(true);
    expect(isVernonAppHostname("www.helixsystems.ca")).toBe(false);
    expect(isVernonAppHostname("ops.helixsystems.ca")).toBe(false);
  });

  it("matches City of Vernon company names", () => {
    expect(isCityOfVernonCompanyName("City of Vernon")).toBe(true);
    expect(isCityOfVernonCompanyName("CITY OF VERNON Recreation")).toBe(true);
    expect(isCityOfVernonCompanyName("Panorama")).toBe(false);
    expect(isCityOfVernonCompanyName(null)).toBe(false);
  });

  it("uses the Vernon mark on vernon.helixsystems.ca", () => {
    const brand = resolveAuthBrand("vernon.helixsystems.ca");
    expect(brand.kind).toBe("vernon");
    expect(brand.cinematicSrc).toBe(CITY_OF_VERNON_LOGO_SRC);
    expect(brand.showPoweredByHelix).toBe(true);
  });

  it("keeps Helix on marketing-only hosts even when the app URL is Vernon", () => {
    vi.stubEnv("NEXT_PUBLIC_PULSE_APP_URL", "https://vernon.helixsystems.ca");
    expect(shouldUseVernonAuthBrand("www.helixsystems.ca")).toBe(false);
    expect(resolveAuthBrand("www.helixsystems.ca").kind).toBe("helix");
    expect(resolveAuthBrand("www.helixsystems.ca").cinematicSrc).toBe(PLATFORM_DEFAULT_LOGO_SRC);
  });

  it("uses Vernon branding on local/dev when the configured app host is Vernon", () => {
    vi.stubEnv("NEXT_PUBLIC_PULSE_APP_URL", "https://vernon.helixsystems.ca");
    expect(shouldUseVernonAuthBrand("localhost")).toBe(true);
    expect(shouldUseVernonAuthBrand("127.0.0.1")).toBe(true);
  });

  it("uses Vernon branding on legacy Pulse app aliases when the deployment is Vernon", () => {
    vi.stubEnv("NEXT_PUBLIC_PULSE_APP_URL", "https://vernon.helixsystems.ca");
    expect(shouldUseVernonAuthBrand("ops.helixsystems.ca")).toBe(true);
    expect(shouldUseVernonAuthBrand("panorama.helixsystems.ca")).toBe(true);
  });

  it("does not use Vernon branding on local/dev when the app URL is another tenant", () => {
    vi.stubEnv("NEXT_PUBLIC_PULSE_APP_URL", "https://ops.helixsystems.ca");
    expect(shouldUseVernonAuthBrand("localhost")).toBe(false);
    expect(resolveAuthBrand("localhost").kind).toBe("helix");
  });

  it("prefers a displayable tenant logo_url on welcome/logout modals", () => {
    const brand = resolveAuthModalBrand({
      hostname: "vernon.helixsystems.ca",
      companyName: "City of Vernon",
      logoUrl: "/images/city-of-vernon-logo.png",
    });
    expect(brand.cinematicSrc).toBe("/images/city-of-vernon-logo.png");
    expect(brand.kind).toBe("vernon");
    expect(brand.showPoweredByHelix).toBe(true);
  });

  it("uses the Vernon mark for a City of Vernon company off the Vernon host", () => {
    const brand = resolveAuthModalBrand({
      hostname: "www.helixsystems.ca",
      companyName: "City of Vernon",
    });
    expect(brand.kind).toBe("vernon");
    expect(brand.cinematicSrc).toBe(CITY_OF_VERNON_LOGO_SRC);
  });
});
