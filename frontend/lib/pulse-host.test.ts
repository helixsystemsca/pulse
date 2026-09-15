import { describe, expect, it } from "vitest";

import { getPulseAppHostnameSet, isPulseAppHost } from "@/lib/pulse-host";

describe("pulse-host", () => {
  it("treats vernon as a Pulse app host by default", () => {
    const hosts = getPulseAppHostnameSet();
    expect(hosts.has("vernon.helixsystems.ca")).toBe(true);
    expect(isPulseAppHost("vernon.helixsystems.ca")).toBe(true);
  });

  it("keeps legacy hosts so existing bookmarks still rewrite `/` to `/login`", () => {
    expect(isPulseAppHost("ops.helixsystems.ca")).toBe(true);
    expect(isPulseAppHost("panorama.helixsystems.ca")).toBe(true);
    expect(isPulseAppHost("www.helixsystems.ca")).toBe(false);
  });
});
