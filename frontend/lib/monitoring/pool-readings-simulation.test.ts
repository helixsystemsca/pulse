import { describe, expect, it } from "vitest";
import {
  chlorineFeederActiveFromSwing,
  co2FeederActiveFromSwing,
  POOL_CHEM_SWING,
  POOL_CHLORINE_MAX,
  POOL_CHLORINE_MIN,
  POOL_PH_MAX,
  POOL_PH_MIN,
  simulatePoolReadings,
} from "@/lib/monitoring/pool-readings-simulation";

const bases = [
  { id: 1, name: "Leisure Pool Controller", chlorine: 2.1, ph: 7.4, flow: 120, temp: 28 },
];

describe("pool-readings-simulation", () => {
  it("feeder thresholds match ±0.4 chemistry swing extremes", () => {
    expect(chlorineFeederActiveFromSwing(-POOL_CHEM_SWING)).toBe(true);
    expect(chlorineFeederActiveFromSwing(POOL_CHEM_SWING)).toBe(false);
    expect(co2FeederActiveFromSwing(POOL_CHEM_SWING)).toBe(true);
    expect(co2FeederActiveFromSwing(-POOL_CHEM_SWING)).toBe(false);
  });

  it("keeps chlorine and pH within 1.8–2.2 and 7.0–7.4", () => {
    const row = simulatePoolReadings(bases, 120, { 1: 118 })[0];
    expect(row.chlorine).toBeGreaterThanOrEqual(POOL_CHLORINE_MIN);
    expect(row.chlorine).toBeLessThanOrEqual(POOL_CHLORINE_MAX);
    expect(row.ph).toBeGreaterThanOrEqual(POOL_PH_MIN);
    expect(row.ph).toBeLessThanOrEqual(POOL_PH_MAX);
    expect(row.flow).toBeGreaterThanOrEqual(bases[0].flow - 4);
    expect(row.flow).toBeLessThanOrEqual(bases[0].flow + 4);
  });
});
