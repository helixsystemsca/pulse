"use client";

import { TankIndicator } from "@/components/monitoring/TankIndicator";
import { co2Tanks } from "@/lib/monitoringMockData";

const CO2_LEVEL_MAX = 1000;

/** Compact ops tile: five tanks share width; cylinders fill vertical space below labels. */
export function Co2MonitoringOpsWidget() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="ops-dash-inner-card flex min-h-0 flex-1 flex-col p-1.5">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 items-stretch gap-1.5">
          {co2Tanks.map((t) => (
            <div key={t.id} className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
              <TankIndicator label={t.name} value={t.level} max={CO2_LEVEL_MAX} compact fillHeight />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
