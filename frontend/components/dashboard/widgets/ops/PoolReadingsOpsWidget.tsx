"use client";

import { Droplets, Gauge, Thermometer, Wind } from "lucide-react";

import { useSimulatedPoolControllers } from "@/hooks/useSimulatedPoolControllers";
import type { PoolController } from "@/lib/monitoringMockData";
import { cn } from "@/lib/cn";

function poolDisplayName(name: string): string {
  return name.replace(/\s+Controller$/i, "");
}

function MetricRow({
  icon: Icon,
  iconClass,
  label,
  children,
}: {
  icon: typeof Droplets;
  iconClass: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-1 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
      <div className="flex min-w-0 items-center gap-0.5">
        <Icon className={cn("h-2.5 w-2.5 shrink-0", iconClass)} aria-hidden />
        <span className="sr-only">{label}</span>
      </div>
      <span className="min-w-0 truncate text-right text-[9px] leading-none">{children}</span>
    </div>
  );
}

function PoolColumnCard({
  name,
  chlorine,
  ph,
  flow,
  temp,
  co2FeederActive,
  chlorineFeederActive,
}: PoolController) {
  return (
    <article className="flex h-full min-h-0 min-w-0 flex-1 flex-col rounded-md border border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] bg-white/95 px-1 py-1 dark:bg-slate-900/70">
      <h3
        className="shrink-0 text-center text-[8px] font-bold leading-tight text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]"
        title={poolDisplayName(name)}
      >
        {poolDisplayName(name)}
      </h3>

      <div className="mt-1 flex min-h-0 flex-1 flex-col justify-center gap-1">
        <MetricRow icon={Droplets} iconClass="text-sky-600 dark:text-sky-400" label="Chlorine">
          <>
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">
              {chlorine}
            </span>{" "}
            <span className="text-[8px]">ppm</span>
          </>
        </MetricRow>
        <MetricRow icon={Gauge} iconClass="text-violet-600 dark:text-violet-400" label="pH">
          <>
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">
              {ph}
            </span>{" "}
            <span className="text-[8px]">pH</span>
          </>
        </MetricRow>
        <MetricRow icon={Wind} iconClass="text-teal-600 dark:text-teal-400" label="Flow">
          <>
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">
              {flow}
            </span>{" "}
            <span className="text-[8px]">GPM</span>
          </>
        </MetricRow>
        <MetricRow icon={Thermometer} iconClass="text-amber-600 dark:text-amber-400" label="Temperature">
          <>
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">
              {temp}
            </span>
            <span className="text-[8px]">°C</span>
          </>
        </MetricRow>
      </div>

      <div className="mt-auto flex shrink-0 flex-col gap-0.5">
        <span
          className={cn(
            "w-full truncate rounded px-0.5 py-px text-center text-[7px] font-bold uppercase tracking-wide",
            co2FeederActive
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-100"
              : "bg-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]",
          )}
        >
          CO₂ {co2FeederActive ? "on" : "off"}
        </span>
        <span
          className={cn(
            "w-full truncate rounded px-0.5 py-px text-center text-[7px] font-bold uppercase tracking-wide",
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

/** Three pool columns — equal width, fill widget height. */
export function PoolReadingsOpsWidget() {
  const pools = useSimulatedPoolControllers();

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-row items-stretch gap-[3px]"
      role="group"
      aria-label="Live pool chemistry"
    >
      {pools.map((c) => (
        <PoolColumnCard key={c.id} {...c} />
      ))}
    </div>
  );
}
