import { describe, expect, it } from "vitest";
import {
  applyTileSnapsToLayout,
  gridUnitsToTile,
  snapToNearestTileFootprint,
  snapLayoutItemToTileFootprint,
  tileFootprintShape,
  tileFootprintToGridUnits,
  TILE_UNIT_COLS,
  TILE_UNIT_ROWS,
} from "@/lib/dashboard/tile-grid";

describe("tile-grid", () => {
  it("maps grid units to logical tiles", () => {
    expect(gridUnitsToTile(6, 12)).toEqual({ tw: 3, th: 6 });
  });

  it("maps logical tiles to grid units", () => {
    expect(tileFootprintToGridUnits({ tw: 2, th: 2 })).toEqual({
      w: TILE_UNIT_COLS * 2,
      h: TILE_UNIT_ROWS * 2,
    });
  });

  it("snaps elastic widgets to allowed footprints only", () => {
    const snapped = snapLayoutItemToTileFootprint(
      { i: "workforce", x: 1, y: 0, w: 7, h: 11 },
      "workforce",
    );
    expect(snapped.w! % TILE_UNIT_COLS).toBe(0);
    expect(snapped.h! % TILE_UNIT_ROWS).toBe(0);
    expect(gridUnitsToTile(snapped.w!, snapped.h!)).toEqual({ tw: 4, th: 6 });
  });

  it("picks nearest footprint by tile distance", () => {
    expect(snapToNearestTileFootprint(3, 4, [{ tw: 2, th: 4 }, { tw: 3, th: 5 }])).toEqual({
      tw: 3,
      th: 5,
    });
  });

  it("classifies footprint shapes", () => {
    expect(tileFootprintShape({ tw: 2, th: 1 })).toBe("2x1");
    expect(tileFootprintShape({ tw: 1, th: 2 })).toBe("1x2");
    expect(tileFootprintShape({ tw: 8, th: 5 })).toBe("large");
  });

  it("quantizes layout items to tile increments", () => {
    const layout = applyTileSnapsToLayout(
      [{ i: "low_inventory", x: 3, y: 0, w: 5, h: 9 }],
      16,
      undefined,
      "quantize",
    );
    expect(layout[0]?.w).toBe(6);
    expect(layout[0]?.h).toBe(10);
    expect(layout[0]?.x).toBe(4);
  });
});
