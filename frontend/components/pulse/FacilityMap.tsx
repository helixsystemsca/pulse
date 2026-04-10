import type { LucideIcon } from "lucide-react";
import { Battery, Car, Sparkles, Truck, Wrench } from "lucide-react";
import type { ReactNode } from "react";

type AssetItem = {
  label: string;
  Icon: LucideIcon;
  status?: "ok" | "warn";
};

function AssetChip({ label, Icon, status = "ok" }: AssetItem) {
  const isOk = status === "ok";
  return (
    <span
      title={label}
      className={`inline-flex max-w-full cursor-default items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[8px] font-semibold shadow-sm transition-transform duration-150 hover:z-[1] hover:scale-[1.02] sm:gap-1 sm:px-2 sm:py-1 sm:text-[9px] ${
        isOk
          ? "border-emerald-200/90 bg-emerald-50 text-emerald-900"
          : "border-amber-200/90 bg-amber-50 text-amber-950"
      }`}
    >
      <Icon className="h-2.5 w-2.5 shrink-0 opacity-85 sm:h-3 sm:w-3" strokeWidth={2} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

function Room({
  title,
  children,
  className = "",
}: {
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative flex flex-col bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.35)] ${className}`}
    >
      <span className="absolute left-1.5 top-1.5 z-[1] max-w-[calc(100%-0.75rem)] text-[8px] font-bold uppercase leading-tight tracking-wide text-slate-600 sm:left-2 sm:top-2 sm:text-[9px]">
        {title}
      </span>
      <div className="mt-auto flex flex-wrap content-end gap-1 px-1.5 pb-1.5 pt-5 sm:gap-1.5 sm:px-2 sm:pb-2 sm:pt-7">
        {children}
      </div>
    </div>
  );
}

/** Vertical service corridor — reads as hallway between storage and bay. */
function HallStripVertical() {
  return (
    <div
      className="relative min-w-[6px] shrink-0 border-x border-dashed border-slate-400/75 bg-[repeating-linear-gradient(180deg,transparent,transparent_3px,rgba(148,163,184,0.12)_3px,rgba(148,163,184,0.12)_4px)] sm:min-w-[10px]"
      aria-hidden
    >
      <span className="absolute inset-y-2 left-1/2 hidden w-px -translate-x-1/2 bg-slate-300/90 sm:block" />
    </div>
  );
}

/** Horizontal main corridor between upper and lower zones. */
function HallStripHorizontal() {
  return (
    <div
      className="relative h-2 shrink-0 border-y border-slate-400/80 bg-slate-100/95 sm:h-2.5"
      aria-hidden
    >
      <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-slate-400/70" />
    </div>
  );
}

export type FacilityMapProps = {
  className?: string;
  /** Tighter chrome when embedded beside marketing copy */
  compact?: boolean;
};

/**
 * Facility floor plan styled like an in-app zone map — blueprint walls, corridors, asymmetric bays.
 */
export function FacilityMap({ className = "", compact = false }: FacilityMapProps) {
  const pad = compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4";

  return (
    <div
      className={`w-full ${className}`}
      role="img"
      aria-label="Facility floor plan: rooms, corridors, and equipment check-in locations"
    >
      <div
        className={`rounded-md border border-slate-200 bg-white/55 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-700/80 dark:bg-ds-bg/55 dark:ring-white/[0.06] ${pad}`}
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-pulse-muted">
          Facility · Zone map
        </p>
        <div className="overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]">
          {/* Outer shell = building perimeter */}
          <div className="inline-block min-w-[min(100%,17rem)] rounded-md border-2 border-slate-500/85 bg-slate-100 p-px shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            <div className="flex flex-col">
              {/* Upper band: utility + storage | hall | large Bay 2 */}
              <div className="grid w-full min-h-[5.25rem] grid-cols-[minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(8px,0.22fr)_minmax(0,2.35fr)] sm:min-h-[6rem] md:min-h-[6.75rem]">
                <Room title="Boiler Room" className="min-h-[5.25rem] border-r border-slate-400/90 sm:min-h-[6rem] md:min-h-[6.75rem]">
                  <span className="text-[8px] italic text-slate-400 sm:text-[9px]">—</span>
                </Room>
                <Room title="Equipment Storage" className="min-h-[5.25rem] border-r border-slate-400/90 sm:min-h-[6rem] md:min-h-[6.75rem]">
                  <AssetChip label="Floor scrubber" Icon={Sparkles} />
                </Room>
                <HallStripVertical />
                <Room title="Bay 2" className="min-h-[5.25rem] sm:min-h-[6rem] md:min-h-[6.75rem]">
                  <AssetChip label="Drill" Icon={Wrench} />
                  <AssetChip label="Battery" Icon={Battery} />
                </Room>
              </div>

              <HallStripHorizontal />

              {/* Lower band: pump | large Bay 1 | garage */}
              <div className="grid w-full min-h-[6.25rem] grid-cols-[minmax(0,0.85fr)_minmax(0,2.65fr)_minmax(0,1fr)] sm:min-h-[7rem] md:min-h-[7.75rem]">
                <Room title="Pump House" className="min-h-[6.25rem] border-r border-t border-slate-400/90 sm:min-h-[7rem] md:min-h-[7.75rem]">
                  <span className="text-[8px] italic text-slate-400 sm:text-[9px]">—</span>
                </Room>
                <Room title="Bay 1" className="min-h-[6.25rem] border-r border-t border-slate-400/90 sm:min-h-[7rem] md:min-h-[7.75rem]">
                  <AssetChip label="Drill" Icon={Wrench} />
                  <AssetChip label="Battery" Icon={Battery} />
                </Room>
                <Room title="Garage Area" className="min-h-[6.25rem] border-t border-slate-400/90 sm:min-h-[7rem] md:min-h-[7.75rem]">
                  <AssetChip label="F-150" Icon={Truck} />
                  <AssetChip label="Gator TE4x2" Icon={Car} />
                </Room>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2 text-left text-[9px] leading-snug text-pulse-muted sm:text-[10px]">
          Live view mirrors Pulse check-in zones and asset tags.
        </p>
      </div>
    </div>
  );
}
