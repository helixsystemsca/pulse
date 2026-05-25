import type { PoolController } from "@/lib/monitoringMockData";

/** Slow chemistry swing for chlorine and pH (±0.4). */
export const POOL_CHEM_SWING = 0.4;

export const POOL_CHLORINE_CENTER = 2;
export const POOL_CHLORINE_MIN = 1.8;
export const POOL_CHLORINE_MAX = 2.2;

export const POOL_PH_CENTER = 7.2;
export const POOL_PH_MIN = 7;
export const POOL_PH_MAX = 7.4;

/** GPM random walk band around each pool base. */
const FLOW_SWING = 4;

/** Temperature slow swing band around each pool base. */
const TEMP_SWING = 1.4;

export type PoolReadingBase = Pick<
  PoolController,
  "id" | "name" | "chlorine" | "ph" | "flow" | "temp"
>;

export type SimulatedPoolReading = PoolController;

/** Chlorine feeder on near minimum (1.8), off near maximum (2.2). */
export function chlorineFeederActiveFromSwing(swing: number): boolean {
  return swing <= -POOL_CHEM_SWING * 0.82;
}

/** CO₂ feeder on near maximum pH (7.4), off near minimum (7.0). */
export function co2FeederActiveFromSwing(swing: number): boolean {
  return swing >= POOL_CHEM_SWING * 0.82;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Next GPM via bounded random walk (updated frequently). */
export function nextFlowReading(current: number, base: number): number {
  const min = base - FLOW_SWING;
  const max = base + FLOW_SWING;
  const step = (Math.random() - 0.5) * 6;
  return Math.round(clamp(current + step, min, max));
}

export type PoolSimState = {
  flowById: Record<number, number>;
};

export function createPoolSimState(bases: PoolReadingBase[]): PoolSimState {
  const flowById: Record<number, number> = {};
  for (const b of bases) flowById[b.id] = b.flow;
  return { flowById };
}

/** Snapshot chemistry + feeder lights from elapsed time and flow state. */
export function simulatePoolReadings(
  bases: PoolReadingBase[],
  elapsedSec: number,
  flowById: Record<number, number>,
): SimulatedPoolReading[] {
  return bases.map((base, index) => {
    const chlorinePeriodSec = 88 + index * 14;
    const phPeriodSec = 102 + index * 18;
    const tempPeriodSec = 76 + index * 12;
    const phaseSeed = index * 1.37;

    const chlorineSwing = POOL_CHEM_SWING * Math.sin((elapsedSec / chlorinePeriodSec) * Math.PI * 2 + phaseSeed);
    const phSwing = POOL_CHEM_SWING * Math.sin((elapsedSec / phPeriodSec) * Math.PI * 2 + phaseSeed + 1.2);
    const tempSwing = TEMP_SWING * 0.35 * Math.sin((elapsedSec / tempPeriodSec) * Math.PI * 2 + phaseSeed * 0.5);

    const chlorine = round1(
      clamp(POOL_CHLORINE_CENTER + chlorineSwing, POOL_CHLORINE_MIN, POOL_CHLORINE_MAX),
    );
    const ph = round1(clamp(POOL_PH_CENTER + phSwing, POOL_PH_MIN, POOL_PH_MAX));
    const temp = Math.round(clamp(base.temp + tempSwing, base.temp - TEMP_SWING, base.temp + TEMP_SWING));
    const flow = flowById[base.id] ?? base.flow;

    return {
      id: base.id,
      name: base.name,
      chlorine,
      ph,
      flow,
      temp,
      chlorineFeederActive: chlorineFeederActiveFromSwing(chlorineSwing),
      co2FeederActive: co2FeederActiveFromSwing(phSwing),
    };
  });
}
