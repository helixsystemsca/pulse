import { afterEach, describe, expect, it, vi } from "vitest";

describe("pulseApp origin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rewrites legacy pulse.helixsystems.ca to panorama for app links", async () => {
    vi.stubEnv("NEXT_PUBLIC_PULSE_APP_URL", "https://pulse.helixsystems.ca");
    vi.stubEnv("NODE_ENV", "production");
    const { pulseApp } = await import("./pulse-app");
    expect(pulseApp.login()).toBe("https://panorama.helixsystems.ca/login");
  });
});
