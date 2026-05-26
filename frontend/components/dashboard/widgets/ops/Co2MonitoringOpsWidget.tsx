"use client";

import { TankIndicator } from "@/components/monitoring/TankIndicator";
import { co2Tanks } from "@/lib/monitoringMockData";

const CO2_LEVEL_MAX = 1000;

/** Compact ops tile: fixed-height tanks, centered as a group (no vertical stretch). */
const OPS_CO2_TANK_HEIGHT = "2.875rem";

export function Co2MonitoringOpsWidget() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="ops-dash-inner-card flex min-h-0 flex-1 flex-col px-1.5 py-1">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <div className="flex max-w-full shrink-0 items-center justify-center gap-1.5 sm:gap-2">
            {co2Tanks.map((t) => (
              <TankIndicator
                key={t.id}
                label={t.name}
                value={t.level}
                max={CO2_LEVEL_MAX}
                compact
                tankHeight={OPS_CO2_TANK_HEIGHT}
                tankWidth="1.75rem"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
