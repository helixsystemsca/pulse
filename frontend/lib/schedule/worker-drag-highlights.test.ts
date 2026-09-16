import { describe, expect, it } from "vitest";
import { defaultSettings } from "./defaults";
import type { Worker } from "./types";
import {
  buildWorkerDragHighlightMap,
  evaluateWorkerDrop,
  mergedPlacementRequiredCerts,
} from "./worker-drag-highlights";

const worker = (patch: Partial<Worker> = {}): Worker => ({
  id: "w1",
  name: "Alex",
  role: "worker",
  active: true,
  certifications: [],
  ...patch,
});

const defs = [
  {
    id: "def-d2",
    code: "D2",
    start_min: 480,
    end_min: 960,
    shift_type: "day",
    cert_requirements: ["P1"],
  },
];

describe("mergedPlacementRequiredCerts", () => {
  it("includes shift-definition certs for a day-band placement window", () => {
    const codes = mergedPlacementRequiredCerts(
      worker(),
      "2026-09-15",
      defaultSettings,
      { start: "08:00", end: "16:00" },
      { shiftDefinitions: defs, placementBand: "day" },
    );
    expect(codes).toContain("P1");
  });
});

describe("buildWorkerDragHighlightMap", () => {
  it("warns when the drop definition requires a cert the worker lacks", () => {
    const map = buildWorkerDragHighlightMap(
      worker(),
      ["2026-09-15"],
      [],
      defaultSettings,
      [],
      { start: "08:00", end: "16:00" },
      undefined,
      true,
      { shiftDefinitions: defs, placementBand: "day" },
    );
    expect(map["2026-09-15"]?.tone).toBe("warning");
    expect(map["2026-09-15"]?.tooltip).toMatch(/P1/i);
  });

  it("stays good when the worker holds the definition cert", () => {
    const map = buildWorkerDragHighlightMap(
      worker({ certifications: ["P1"] }),
      ["2026-09-15"],
      [],
      defaultSettings,
      [],
      { start: "08:00", end: "16:00" },
      undefined,
      true,
      { shiftDefinitions: defs, placementBand: "day" },
    );
    expect(map["2026-09-15"]?.tone).toBe("good");
  });
});

describe("evaluateWorkerDrop", () => {
  it("returns training alarms from definition certs used on drop", () => {
    const ev = evaluateWorkerDrop(
      worker(),
      "2026-09-15",
      [],
      defaultSettings,
      [],
      { start: "08:00", end: "16:00" },
      { shiftDefinitions: defs, placementBand: "day" },
    );
    expect(ev.ok).toBe(true);
    expect(ev.trainingAlarms?.[0]?.code).toBe("training_missing");
  });
});
