import { describe, expect, it } from "vitest";
import { kioskPageOffsets } from "@/lib/dashboards/kiosk";

describe("kioskPageOffsets", () => {
  it("stays on one page when content fits", () => {
    expect(kioskPageOffsets(900, 900)).toEqual([0]);
    expect(kioskPageOffsets(910, 900)).toEqual([0]);
  });

  it("pages through overflow with a last offset at the bottom", () => {
    const pages = kioskPageOffsets(2000, 800, 64);
    expect(pages[0]).toBe(0);
    expect(pages[pages.length - 1]).toBe(1200);
    expect(pages.length).toBeGreaterThan(1);
    for (let i = 1; i < pages.length; i++) {
      expect(pages[i]).toBeGreaterThan(pages[i - 1]);
    }
  });
});
