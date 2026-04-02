import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";

export function CompanyHero() {
  return (
    <section className="overflow-x-clip bg-helix-bg py-12">
      <div className="mx-auto grid max-w-7xl items-center gap-7 px-6 md:grid-cols-2 md:gap-7">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#d5e4f5] px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-helix-primary" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-helix-primary">
              Helix Systems
            </span>
          </div>

          <h1 className="mt-4 font-headline text-4xl font-extrabold leading-[1.08] tracking-tight text-helix-onSurface md:text-5xl lg:text-6xl">
            Industrial operations,
            <br />
            <span className="text-helix-primary">made clear.</span>
          </h1>

          <p className="mt-4 max-w-xl text-lg leading-relaxed text-helix-onSurfaceVariant">
            We partner with operators who run complex sites—manufacturing, terminals, logistics, and
            infrastructure. Helix bridges the gap between what happens on the ground and what your
            leadership needs to see.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link
              href="/pulse"
              className="inline-flex items-center gap-2 rounded-xl bg-helix-primary px-8 py-4 font-headline text-base font-bold text-white shadow-helix transition-all hover:bg-helix-primary-dim no-underline"
            >
              Explore Pulse
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="#products"
              className="inline-flex items-center rounded-xl bg-helix-surfaceLow px-8 py-4 font-headline text-base font-bold text-helix-onSurface transition-colors hover:bg-helix-outline/30 no-underline"
            >
              What we build
            </a>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
          <div className="relative overflow-hidden rounded-2xl shadow-helix ring-1 ring-helix-outline/30">
            <div className="aspect-[20/9] w-full bg-gradient-to-br from-[#d5e4f5] via-white to-helix-surfaceLow md:aspect-[25/12]">
              <div className="flex h-full flex-col justify-between p-4 md:p-5">
                <div className="grid grid-cols-3 gap-3">
                  {[65, 82, 74].map((v, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-white/90 p-3 shadow-sm backdrop-blur-sm"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide text-helix-onSurfaceVariant">
                        Zone {String.fromCharCode(65 + i)}
                      </p>
                      <p className="mt-1 font-headline text-xl font-black text-helix-primary">{v}%</p>
                      <p className="text-[10px] text-helix-onSurfaceVariant">Throughput</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-white/80 p-4 backdrop-blur-sm">
                  <p className="text-xs font-bold text-helix-onSurface">Operations snapshot</p>
                  <p className="mt-1 text-sm text-helix-onSurfaceVariant">
                    Live roll-up across lines, bays, and shifts—without another spreadsheet export.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-4 w-full max-w-[min(100%,280px)] md:absolute md:-bottom-3 md:left-4 md:mt-0 md:max-w-[280px] lg:left-6 lg:max-w-[300px]">
            <div className="rounded-2xl border border-helix-outline/25 bg-white/95 p-4 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wide text-helix-primary">
                  Real-time Pulse
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-helix-onSurface">Feed healthy · 124 nodes</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-helix-onSurfaceVariant">
                <Radio className="h-3.5 w-3.5 text-helix-primary" />
                Streaming telemetry &amp; workforce signals
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
