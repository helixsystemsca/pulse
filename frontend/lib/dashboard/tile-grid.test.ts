import { describe, expect, it } from "vitest";
import {
  applyTileSnapsToLayout,
  DASHBOARD_GRID_COLS,
  gridUnitsToTile,
  migrateLegacyDashboardLayout,
  snapToNearestTileFootprint,
  snapLayoutItemToTileFootprint,
  tileFootprintShape,
  tileFootprintToGridUnits,
  TILE_UNIT_COLS,
  TILE_UNIT_ROWS,
} from "@/lib/dashboard/tile-grid";

describe("tile-grid", () => {
  it("uses atomic 1×1 grid cells", () => {
    expect(TILE_UNIT_COLS).toBe(1);
    expect(TILE_UNIT_ROWS).toBe(1);
    expect(DASHBOARD_GRID_COLS).toBe(24);
  });

  it("maps grid units to atomic tiles 1:1", () => {
    expect(gridUnitsToTile(8, 6)).toEqual({ tw: 8, th: 6 });
  });

  it("maps atomic tiles to grid units", () => {
    expect(tileFootprintToGridUnits({ tw: 4, th: 2 })).toEqual({ w: 4, h: 2 });
  });

  it("snaps elastic widgets to allowed footprints only", () => {
    const snapped = snapLayoutItemToTileFootprint(
      { i: "workforce", x: 2, y: 0, w: 11, h: 9 },
      "workforce",
    );
    expect(snapped.w! % TILE_UNIT_COLS).toBe(0);
    expect(snapped.h! % TILE_UNIT_ROWS).toBe(0);
    expect(gridUnitsToTile(snapped.w!, snapped.h!)).toEqual({ tw: 9, th: 7 });
  });

  it("picks nearest footprint by tile distance", () => {
    expect(snapToNearestTileFootprint(6, 5, [{ tw: 5, th: 5 }, { tw: 6, th: 6 }])).toEqual({
      tw: 6,
      th: 6,
    });
  });

  it("classifies footprint shapes on atomic grid", () => {
    expect(tileFootprintShape({ tw: 4, th: 2 })).toBe("2x1");
    expect(tileFootprintShape({ tw: 3, th: 5 })).toBe("1x2");
    expect(tileFootprintShape({ tw: 24, th: 7 })).toBe("large");
  });

  it("quantizes layout items to atomic increments", () => {
    const layout = applyTileSnapsToLayout(
      [{ i: "low_inventory", x: 3, y: 0, w: 7, h: 9 }],
      24,
      undefined,
      "quantize",
    );
    expect(layout[0]?.w).toBe(7);
    expect(layout[0]?.h).toBe(9);
    expect(layout[0]?.x).toBe(3);
  });

  it("migrates legacy 16-col macro-tile layouts to atomic 24-col grid", () => {
    const migrated = migrateLegacyDashboardLayout([
      { i: "workforce", x: 0, y: 12, w: 6, h: 10 },
    ]);
    expect(migrated[0]?.w).toBe(9);
    expect(migrated[0]?.h).toBe(6);
    expect(migrated[0]?.x).toBe(0);
  });
});
