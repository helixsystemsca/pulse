import { describe, expect, it } from "vitest";
import {
  chlorineFeederActiveFromSwing,
  co2FeederActiveFromSwing,
  simulatePoolReadings,
} from "@/lib/monitoring/pool-readings-simulation";

const bases = [
  { id: 1, name: "Leisure Pool Controller", chlorine: 2.1, ph: 7.4, flow: 120, temp: 28 },
];

describe("pool-readings-simulation", () => {
  it("feeder thresholds match ±4 swing extremes", () => {
    expect(chlorineFeederActiveFromSwing(-4)).toBe(true);
    expect(chlorineFeederActiveFromSwing(4)).toBe(false);
    expect(co2FeederActiveFromSwing(4)).toBe(true);
    expect(co2FeederActiveFromSwing(-4)).toBe(false);
  });

  it("keeps simulated readings within base ±4", () => {
    const row = simulatePoolReadings(bases, 120, { 1: 118 })[0];
    expect(row.chlorine).toBeGreaterThanOrEqual(0);
    expect(row.chlorine).toBeLessThanOrEqual(bases[0].chlorine + 4);
    expect(row.flow).toBeGreaterThanOrEqual(bases[0].flow - 4);
    expect(row.flow).toBeLessThanOrEqual(bases[0].flow + 4);
  });
});
