import type { PoolController } from "@/lib/monitoringMockData";

const SWING = 4;

export type PoolReadingBase = Pick<
  PoolController,
  "id" | "name" | "chlorine" | "ph" | "flow" | "temp"
>;

export type SimulatedPoolReading = PoolController;

/** Chlorine feeder on near minimum (−4), off near maximum (+4). */
export function chlorineFeederActiveFromSwing(swing: number): boolean {
  return swing <= -SWING * 0.82;
}

/** CO₂ feeder on near maximum pH (+4), off near minimum (−4). */
export function co2FeederActiveFromSwing(swing: number): boolean {
  return swing >= SWING * 0.82;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Next GPM via bounded random walk (updated frequently). */
export function nextFlowReading(current: number, base: number): number {
  const min = base - SWING;
  const max = base + SWING;
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

    const chlorineSwing = SWING * Math.sin((elapsedSec / chlorinePeriodSec) * Math.PI * 2 + phaseSeed);
    const phSwing = SWING * Math.sin((elapsedSec / phPeriodSec) * Math.PI * 2 + phaseSeed + 1.2);
    const tempSwing = SWING * 0.35 * Math.sin((elapsedSec / tempPeriodSec) * Math.PI * 2 + phaseSeed * 0.5);

    const chlorine = round1(clamp(base.chlorine + chlorineSwing, base.chlorine - SWING, base.chlorine + SWING));
    const ph = round1(clamp(base.ph + phSwing, base.ph - SWING, base.ph + SWING));
    const temp = Math.round(clamp(base.temp + tempSwing, base.temp - SWING, base.temp + SWING));
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
