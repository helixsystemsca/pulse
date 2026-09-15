import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_PULSE_APP_ORIGIN, pulseAppHref } from "@/lib/pulse-app";

describe("pulseAppHref", () => {
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.window;
  });

  it("defaults to vernon when rendering off the app host", () => {
    expect(DEFAULT_PULSE_APP_ORIGIN).toBe("https://vernon.helixsystems.ca");
    expect(pulseAppHref("/login")).toBe("https://vernon.helixsystems.ca/login");
    expect(pulseAppHref("overview")).toBe("https://vernon.helixsystems.ca/overview");
  });

  it("stays same-origin on vernon so login does not bounce to another host", () => {
    // @ts-expect-error jsdom-less vitest stub
    globalThis.window = { location: { hostname: "vernon.helixsystems.ca" } };
    expect(pulseAppHref("/overview")).toBe("/overview");
    expect(pulseAppHref("login")).toBe("/login");
  });

  it("stays same-origin on a legacy app host", () => {
    // @ts-expect-error jsdom-less vitest stub
    globalThis.window = { location: { hostname: "ops.helixsystems.ca" } };
    expect(pulseAppHref("/overview")).toBe("/overview");
  });

  it("uses the configured origin from the marketing host", () => {
    // @ts-expect-error jsdom-less vitest stub
    globalThis.window = { location: { hostname: "www.helixsystems.ca" } };
    expect(pulseAppHref("/login")).toBe("https://vernon.helixsystems.ca/login");
  });
});
