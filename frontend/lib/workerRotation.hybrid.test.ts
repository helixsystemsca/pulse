import { describe, expect, it } from "vitest";
import {
  buildRecurringRowsFromHybrid,
  hybridDraftFromRecurringRows,
  hybridRotationDayOverlapError,
} from "@/lib/workerRotation";

describe("hybrid rotation", () => {
  it("merges two blocks into per-weekday recurring rows", () => {
    const rows = buildRecurringRowsFromHybrid({
      mainBand: "afternoon",
      mainDays: [false, true, true, true, false, false, false],
      mainWindow: { start: "14:00", end: "22:00" },
      secondaryDays: [false, false, false, false, true, false, false],
      secondaryWindow: { start: "16:00", end: "00:00" },
    });
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.day_of_week === "thursday")).toEqual({
      day_of_week: "thursday",
      start: "16:00",
      end: "00:00",
    });
  });

  it("parses two-window recurring back into hybrid draft", () => {
    const rows = buildRecurringRowsFromHybrid({
      mainBand: "afternoon",
      mainDays: [false, true, true, true, false, false, false],
      mainWindow: { start: "14:00", end: "22:00" },
      secondaryDays: [false, false, false, false, true, false, false],
      secondaryWindow: { start: "16:00", end: "00:00" },
    });
    const draft = hybridDraftFromRecurringRows(rows);
    expect(draft?.mainWindow).toEqual({ start: "14:00", end: "22:00" });
    expect(draft?.secondaryWindow).toEqual({ start: "16:00", end: "00:00" });
  });

  it("rejects overlapping weekdays", () => {
    const err = hybridRotationDayOverlapError({
      mainBand: "afternoon",
      mainDays: [false, true, true, true, true, false, false],
      mainWindow: { start: "14:00", end: "22:00" },
      secondaryDays: [false, false, false, false, true, false, false],
      secondaryWindow: { start: "16:00", end: "00:00" },
    });
    expect(err).toMatch(/Thu/i);
  });
});
