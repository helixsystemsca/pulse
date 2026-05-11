"use client";

import Link from "next/link";
import { Droplets, Gauge, Thermometer, Wind } from "lucide-react";

import { pulseAppHref } from "@/lib/pulse-app";
import { poolControllers } from "@/lib/monitoringMockData";
import { cn } from "@/lib/cn";

function PoolCard(props: (typeof poolControllers)[number]) {
  const { name, chlorine, ph, flow, temp, co2FeederActive, chlorineFeederActive } = props;
  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--ops-dash-widget-bg,#fff)_55%,var(--ops-dash-border,#cbd5e1))] bg-[color-mix(in_srgb,var(--ops-dash-widget-bg,#ffffff)_94%,var(--ops-dash-inner-bg,#f1f5f9))] p-3 shadow-sm dark:border-white/[0.07] dark:bg-[color-mix(in_srgb,#0f172a_92%,#1e293b)]">
      <p className="text-xs font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">{name}</p>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Droplets className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          <dt className="sr-only">Chlorine</dt>
          <dd>
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">{chlorine}</span> ppm
          </dd>
        </div>
        <div className="flex items-center gap-1.5 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Gauge className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          <dt className="sr-only">pH</dt>
          <dd>
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">{ph}</span> pH
          </dd>
        </div>
        <div className="flex items-center gap-1.5 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Wind className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
          <dt className="sr-only">Flow</dt>
          <dd>
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">{flow}</span> GPM
          </dd>
        </div>
        <div className="flex items-center gap-1.5 text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          <Thermometer className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <dt className="sr-only">Temperature</dt>
          <dd>
            <span className="font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">{temp}</span> °C
          </dd>
        </div>
      </dl>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            co2FeederActive ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-100" : "bg-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]",
          )}
        >
          CO₂ {co2FeederActive ? "on" : "off"}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
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
  const monitoringHref = pulseAppHref("/monitoring");

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-[color-mix(in_srgb,var(--ops-dash-widget-bg,#fff)_65%,var(--ops-dash-border,#cbd5e1))] bg-[var(--ops-dash-widget-bg,#ffffff)] p-3 shadow-sm dark:border-white/[0.07] dark:bg-[color-mix(in_srgb,#0f172a_96%,#1e293b)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]">Live chemistry · demo controllers</p>
        <Link href={monitoringHref} className="text-[11px] font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline">
          Details
        </Link>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-0.5">
        {poolControllers.map((c) => (
          <PoolCard key={c.id} {...c} />
        ))}
      </div>
    </div>
  );
}
