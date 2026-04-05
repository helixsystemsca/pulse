import { Radio } from "lucide-react";
import { landingHero } from "@/components/landing-variants/landingContent";

export type HeroDemoPanelProps = {
  frameClassName?: string;
  gradientClassName?: string;
  floatingWrapClassName?: string;
  floatingCardClassName?: string;
  /** Dark glass cards: use with enterprise/dark landing variants. */
  floatingTone?: "light" | "dark";
};

export function HeroDemoPanel({
  frameClassName = "",
  gradientClassName = "",
  floatingWrapClassName = "",
  floatingCardClassName = "",
  floatingTone = "light",
}: HeroDemoPanelProps) {
  const f = floatingTone === "dark";
  return (
    <div className={`relative mx-auto w-full max-w-xl md:mx-0 md:max-w-none ${frameClassName}`.trim()}>
      <div className="relative overflow-hidden rounded-2xl shadow-helix ring-1 ring-helix-outline/30">
        <div
          className={`aspect-[20/9] w-full bg-gradient-to-br from-[#d5e4f5] via-white to-helix-surfaceLow md:aspect-[25/12] ${gradientClassName}`.trim()}
        >
          <div className="flex h-full flex-col justify-between p-4 md:p-5">
            <div className="grid grid-cols-3 gap-3">
              {landingHero.zoneStats.map((z, i) => (
                <div key={i} className="rounded-xl bg-white/90 p-3 shadow-sm backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-helix-onSurfaceVariant">
                    Zone {String.fromCharCode(65 + i)}
                  </p>
                  <p className="mt-1 font-headline text-xl font-black text-helix-primary">{z.throughputPercent}%</p>
                  <p className="text-[10px] text-helix-onSurfaceVariant">Throughput</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-white/80 p-4 backdrop-blur-sm">
              <p className="text-xs font-bold text-helix-onSurface">{landingHero.snapshotTitle}</p>
              <p className="mt-1 text-sm text-helix-onSurfaceVariant">{landingHero.snapshotBody}</p>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`relative z-10 mt-4 w-full max-w-[min(100%,280px)] md:absolute md:-bottom-3 md:left-4 md:mt-0 md:max-w-[280px] lg:left-6 lg:max-w-[300px] ${floatingWrapClassName}`.trim()}
      >
        <div
          className={`rounded-2xl border border-helix-outline/25 bg-white/95 p-4 shadow-lg backdrop-blur-md ${floatingCardClassName}`.trim()}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span
              className={`text-xs font-bold uppercase tracking-wide ${f ? "text-cyan-200" : "text-helix-primary"}`}
            >
              {landingHero.pulseBadge}
            </span>
          </div>
          <p className={`mt-2 text-sm font-semibold ${f ? "text-white" : "text-helix-onSurface"}`}>
            {landingHero.pulseTitle}
          </p>
          <p className={`mt-1 flex items-center gap-1.5 text-xs ${f ? "text-slate-300" : "text-helix-onSurfaceVariant"}`}>
            <Radio className={`h-3.5 w-3.5 ${f ? "text-cyan-300" : "text-helix-primary"}`} />
            {landingHero.pulseSub}
          </p>
        </div>
      </div>
    </div>
  );
}
