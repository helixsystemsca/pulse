"use client";

import { TankIndicator } from "@/components/monitoring/TankIndicator";
import { co2Tanks } from "@/lib/monitoringMockData";

const CO2_LEVEL_MAX = 1000;

/** Compact ops tile: horizontal tank strip fills shell height (see `fillHeight` on {@link TankIndicator}). */
export function Co2MonitoringOpsWidget() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="flex h-full min-h-0 min-w-0 flex-1 items-stretch gap-2 overflow-x-auto overflow-y-hidden px-0.5">
        {co2Tanks.map((t) => (
          <TankIndicator key={t.id} label={t.name} value={t.level} max={CO2_LEVEL_MAX} compact fillHeight />
        ))}
      </div>
    </div>
  );
}
