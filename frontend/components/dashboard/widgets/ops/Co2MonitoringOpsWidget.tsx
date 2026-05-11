"use client";

import Link from "next/link";

import { TankIndicator } from "@/components/monitoring/TankIndicator";
import { pulseAppHref } from "@/lib/pulse-app";
import { co2Tanks } from "@/lib/monitoringMockData";

const CO2_LEVEL_MAX = 1000;

export function Co2MonitoringOpsWidget() {
  const monitoringHref = pulseAppHref("/monitoring");

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="mb-0.5 flex shrink-0 justify-end">
        <Link href={monitoringHref} className="text-[10px] font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline">
          Systems
        </Link>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-start overflow-x-auto overflow-y-hidden">
        <div className="flex min-w-min items-start justify-center gap-2 px-0.5 sm:gap-3">
          {co2Tanks.map((t) => (
            <TankIndicator key={t.id} label={t.name} value={t.level} max={CO2_LEVEL_MAX} compact />
          ))}
        </div>
      </div>
    </div>
  );
}
