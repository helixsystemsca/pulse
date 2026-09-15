import { describe, expect, it } from "vitest";

import { DEFAULT_APP_HEADER_WORDMARK, resolveAppHeaderWordmark } from "@/lib/branding/header-wordmark";

describe("header-wordmark", () => {
  it("uses the platform default when the tenant has no custom wordmark", () => {
    expect(resolveAppHeaderWordmark(null)).toBe(DEFAULT_APP_HEADER_WORDMARK);
    expect(resolveAppHeaderWordmark({ id: "1", name: "City of Vernon" })).toBe(DEFAULT_APP_HEADER_WORDMARK);
  });

  it("uses a custom header wordmark when set", () => {
    expect(
      resolveAppHeaderWordmark({ id: "1", name: "City of Vernon", header_wordmark: "Vernon Rec" }),
    ).toBe("Vernon Rec");
  });
});
