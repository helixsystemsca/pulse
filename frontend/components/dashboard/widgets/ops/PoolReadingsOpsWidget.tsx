"use client";

import { Droplets, Gauge, Thermometer, Wind } from "lucide-react";

import { poolControllers } from "@/lib/monitoringMockData";
import { cn } from "@/lib/cn";

function PoolCard(props: (typeof poolControllers)[number]) {
  const { name, chlorine, ph, flow, temp, co2FeederActive, chlorineFeederActive } = props;
  return (
    <div className="ops-dash-inner-card flex h-full min-h-0 flex-col p-2">
      <p className="text-[11px] font-bold leading-tight text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">{name}</p>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-1.5 gap-y-1 text-[10px]">
        <div className="flex items-center gap-1 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Droplets className="h-3 w-3 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          <dt className="sr-only">Chlorine</dt>
          <dd>
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">{chlorine}</span> ppm
          </dd>
        </div>
        <div className="flex items-center gap-1 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Gauge className="h-3 w-3 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          <dt className="sr-only">pH</dt>
          <dd>
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">{ph}</span> pH
          </dd>
        </div>
        <div className="flex items-center gap-1 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Wind className="h-3 w-3 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
          <dt className="sr-only">Flow</dt>
          <dd>
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">{flow}</span> GPM
          </dd>
        </div>
        <div className="flex items-center gap-1 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Thermometer className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <dt className="sr-only">Temperature</dt>
          <dd>
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">{temp}</span> °C
          </dd>
        </div>
      </dl>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[8px] font-bold uppercase tracking-wide",
            co2FeederActive ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-100" : "bg-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]",
          )}
        >
          CO₂ {co2FeederActive ? "on" : "off"}
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[8px] font-bold uppercase tracking-wide",
            chlorineFeederActive ? "bg-sky-100 text-sky-950 dark:bg-sky-950/45 dark:text-sky-100" : "bg-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]",
          )}
        >
          Cl {chlorineFeederActive ? "on" : "off"}
        </span>
      </div>
    </div>
  );
}

export function PoolReadingsOpsWidget() {
  return (
    <div className="ops-dash-inner-card flex h-full min-h-0 flex-col overflow-hidden p-0">
      <p className="shrink-0 px-2 pt-1.5 text-[10px] font-semibold leading-tight text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]">
        Live chemistry · demo controllers
      </p>
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-2 pb-2 pt-1">
        <div className="flex h-full min-h-0 min-w-min gap-2">
          {poolControllers.map((c) => (
            <div key={c.id} className="min-w-[8.75rem] flex-1 basis-0">
              <PoolCard {...c} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
