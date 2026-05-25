"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { poolControllers, type PoolController } from "@/lib/monitoringMockData";
import {
  createPoolSimState,
  nextFlowReading,
  simulatePoolReadings,
  type PoolReadingBase,
} from "@/lib/monitoring/pool-readings-simulation";

const FLOW_TICK_MS = 900;
const SLOW_TICK_MS = 400;

type Options = {
  /** Override demo bases (defaults to `poolControllers`). */
  bases?: PoolReadingBase[];
};

/**
 * Live-demo pool chemistry: slow ±4 swings for Cl/pH/temp with feeder interlocks;
 * GPM random-walks on a faster cadence.
 */
export function useSimulatedPoolControllers(options?: Options): PoolController[] {
  const bases = options?.bases ?? poolControllers;
  const startMsRef = useRef(typeof performance !== "undefined" ? performance.now() : Date.now());
  const flowStateRef = useRef(createPoolSimState(bases));
  const [flowTick, setFlowTick] = useState(0);
  const [slowTick, setSlowTick] = useState(0);

  useEffect(() => {
    flowStateRef.current = createPoolSimState(bases);
    startMsRef.current = performance.now();
  }, [bases]);

  useEffect(() => {
    const id = window.setInterval(() => {
      for (const b of bases) {
        const cur = flowStateRef.current.flowById[b.id] ?? b.flow;
        flowStateRef.current.flowById[b.id] = nextFlowReading(cur, b.flow);
      }
      setFlowTick((n) => n + 1);
    }, FLOW_TICK_MS);
    return () => window.clearInterval(id);
  }, [bases]);

  useEffect(() => {
    const id = window.setInterval(() => setSlowTick((n) => n + 1), SLOW_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    void flowTick;
    void slowTick;
    const elapsedSec = (performance.now() - startMsRef.current) / 1000;
    return simulatePoolReadings(bases, elapsedSec, flowStateRef.current.flowById);
  }, [bases, flowTick, slowTick]);
}
