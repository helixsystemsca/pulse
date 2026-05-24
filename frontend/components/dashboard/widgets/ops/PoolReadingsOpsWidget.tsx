"use client";

import { Droplets, Gauge, Thermometer, Wind } from "lucide-react";

import { poolControllers } from "@/lib/monitoringMockData";
import { cn } from "@/lib/cn";

function poolDisplayName(name: string): string {
  return name.replace(/\s+Controller$/i, "");
}

function PoolCard(props: (typeof poolControllers)[number]) {
  const { name, chlorine, ph, flow, temp, co2FeederActive, chlorineFeederActive } = props;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col rounded-md border border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] bg-white/95 p-1 dark:bg-slate-900/70">
      <p
        className="truncate text-[9px] font-bold leading-tight text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]"
        title={poolDisplayName(name)}
      >
        {poolDisplayName(name)}
      </p>
      <dl className="mt-0.5 grid min-w-0 grid-cols-2 gap-x-1 gap-y-0.5 text-[9px] leading-none">
        <div className="flex min-w-0 items-center gap-0.5 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Droplets className="h-2.5 w-2.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          <dt className="sr-only">Chlorine</dt>
          <dd className="min-w-0 truncate">
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">{chlorine}</span>{" "}
            <span className="text-[8px]">ppm</span>
          </dd>
        </div>
        <div className="flex min-w-0 items-center gap-0.5 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Gauge className="h-2.5 w-2.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          <dt className="sr-only">pH</dt>
          <dd className="min-w-0 truncate">
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">{ph}</span>{" "}
            <span className="text-[8px]">pH</span>
          </dd>
        </div>
        <div className="flex min-w-0 items-center gap-0.5 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Wind className="h-2.5 w-2.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
          <dt className="sr-only">Flow</dt>
          <dd className="min-w-0 truncate">
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">{flow}</span>{" "}
            <span className="text-[8px]">GPM</span>
          </dd>
        </div>
        <div className="flex min-w-0 items-center gap-0.5 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Thermometer className="h-2.5 w-2.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <dt className="sr-only">Temperature</dt>
          <dd className="min-w-0 truncate">
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">{temp}</span>
            <span className="text-[8px]">°C</span>
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex min-w-0 gap-0.5 pt-0.5">
        <span
          className={cn(
            "min-w-0 flex-1 truncate rounded px-1 py-px text-center text-[7px] font-bold uppercase tracking-wide",
            co2FeederActive
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-100"
              : "bg-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]",
          )}
        >
          CO₂ {co2FeederActive ? "on" : "off"}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate rounded px-1 py-px text-center text-[7px] font-bold uppercase tracking-wide",
            chlorineFeederActive
              ? "bg-sky-100 text-sky-950 dark:bg-sky-950/45 dark:text-sky-100"
              : "bg-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]",
          )}
        >
          Cl {chlorineFeederActive ? "on" : "off"}
        </span>
      </div>
    </div>
  );
}

/** Three-up pool chemistry strip — sized to fit compact/tall ops tiles without horizontal scroll. */
export function PoolReadingsOpsWidget() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <p className="shrink-0 px-1 pt-0.5 text-[9px] font-semibold leading-none text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]">
        Live chemistry · demo
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-1 px-1 pb-1 pt-0.5">
        {poolControllers.map((c) => (
          <PoolCard key={c.id} {...c} />
        ))}
      </div>
    </div>
  );
}
