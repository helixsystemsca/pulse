"use client";

import Link from "next/link";
import { Gauge } from "lucide-react";

import { TankIndicator } from "@/components/monitoring/TankIndicator";
import { pulseAppHref } from "@/lib/pulse-app";
import { co2Tanks } from "@/lib/monitoringMockData";

const CO2_LEVEL_MAX = 1000;

export function Co2MonitoringOpsWidget() {
  const monitoringHref = pulseAppHref("/monitoring");

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-[color-mix(in_srgb,var(--ops-dash-widget-bg,#fff)_65%,var(--ops-dash-border,#cbd5e1))] bg-[var(--ops-dash-widget-bg,#ffffff)] p-3 shadow-sm dark:border-white/[0.07] dark:bg-[color-mix(in_srgb,#0f172a_96%,#1e293b)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]">
          <Gauge className="h-3.5 w-3.5 opacity-80" aria-hidden />
          <span>0–{CO2_LEVEL_MAX} sensor scale · demo feed</span>
        </div>
        <Link href={monitoringHref} className="shrink-0 text-[11px] font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline">
          Systems
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden py-2">
        <div className="flex min-w-min items-end justify-center gap-5 px-1 sm:gap-8">
          {co2Tanks.map((t) => (
            <TankIndicator key={t.id} label={t.name} value={t.level} max={CO2_LEVEL_MAX} sublabel={t.location} />
          ))}
        </div>
      </div>
    </div>
  );
}
