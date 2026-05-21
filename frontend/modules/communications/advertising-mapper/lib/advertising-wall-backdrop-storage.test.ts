import { describe, expect, it } from "vitest";
import { mergeWallPlanBackdrops } from "@/modules/communications/advertising-mapper/lib/advertising-wall-backdrop-storage";

describe("mergeWallPlanBackdrops", () => {
  it("merges stored backdrop into matching wall id", () => {
    const walls = [{ id: "left", name: "Left" }];
    const merged = mergeWallPlanBackdrops(walls, {
      left: { backdropUrl: "data:image/png;base64,x", backdropNaturalWidth: 100, backdropNaturalHeight: 50 },
    });
    expect(merged[0]!.backdropUrl).toBe("data:image/png;base64,x");
  });
});
