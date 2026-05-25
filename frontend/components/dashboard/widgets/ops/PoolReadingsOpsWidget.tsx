"use client";

import { Droplets, Gauge, Thermometer, Wind } from "lucide-react";

import { useSimulatedPoolControllers } from "@/hooks/useSimulatedPoolControllers";
import type { PoolController } from "@/lib/monitoringMockData";
import { cn } from "@/lib/cn";

function poolDisplayName(name: string): string {
  return name.replace(/\s+Controller$/i, "");
}

function PoolCard({
  name,
  chlorine,
  ph,
  flow,
  temp,
  co2FeederActive,
  chlorineFeederActive,
}: PoolController) {
  return (
    <article className="flex h-full min-h-0 min-w-0 flex-col rounded-md border border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] bg-white/95 px-2 py-1.5 dark:bg-slate-900/70">
      <h3
        className="shrink-0 text-[10px] font-bold leading-tight text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]"
        title={poolDisplayName(name)}
      >
        {poolDisplayName(name)}
      </h3>

      <dl className="mt-1.5 grid min-h-0 flex-1 grid-cols-2 gap-x-2 gap-y-1.5 text-[10px]">
        <div className="flex items-center gap-1 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Droplets className="h-3 w-3 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          <dd className="min-w-0">
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">
              {chlorine}
            </span>{" "}
            <span className="text-[9px]">ppm</span>
          </dd>
        </div>
        <div className="flex items-center gap-1 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Gauge className="h-3 w-3 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          <dd className="min-w-0">
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">
              {ph}
            </span>{" "}
            <span className="text-[9px]">pH</span>
          </dd>
        </div>
        <div className="flex items-center gap-1 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Wind className="h-3 w-3 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
          <dd className="min-w-0">
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">
              {flow}
            </span>{" "}
            <span className="text-[9px]">GPM</span>
          </dd>
        </div>
        <div className="flex items-center gap-1 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Thermometer className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <dd className="min-w-0">
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">
              {temp}
            </span>
            <span className="text-[9px]">°C</span>
          </dd>
        </div>
      </dl>

      <div className="mt-1.5 flex shrink-0 gap-1">
        <span
          className={cn(
            "min-w-0 flex-1 truncate rounded px-1 py-0.5 text-center text-[7px] font-bold uppercase tracking-wide",
            co2FeederActive
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-100"
              : "bg-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]",
          )}
        >
          CO₂ {co2FeederActive ? "on" : "off"}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate rounded px-1 py-0.5 text-center text-[7px] font-bold uppercase tracking-wide",
            chlorineFeederActive
              ? "bg-sky-100 text-sky-950 dark:bg-sky-950/45 dark:text-sky-100"
              : "bg-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]",
          )}
        >
          Cl {chlorineFeederActive ? "on" : "off"}
        </span>
      </div>
    </article>
  );
}

/** Three pool cards in one row (1×3); each card keeps a 2×2 metric grid inside. */
export function PoolReadingsOpsWidget() {
  const pools = useSimulatedPoolControllers();

  return (
    <div
      className="grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-3 grid-rows-1 items-stretch gap-[3px]"
      role="group"
      aria-label="Live pool chemistry"
    >
      {pools.map((c) => (
        <PoolCard key={c.id} {...c} />
      ))}
    </div>
  );
}
