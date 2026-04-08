import { Battery, Bell, ChevronRight, Disc3, Drill, Home, MapPin, Package, Search, User } from "lucide-react";
import { FeatureItem } from "./FeatureItem";
import { SectionWrapper } from "./SectionWrapper";

function PhoneChrome() {
  return (
    <div className="relative mx-auto w-full max-w-[300px] shrink-0">
      <div className="aspect-[9/19.5] w-full overflow-hidden rounded-3xl bg-gradient-to-b from-slate-500 via-slate-700 to-slate-900 p-[3px] shadow-2xl shadow-slate-900/40 ring-1 ring-white/15">
        <div className="relative h-full min-h-0 overflow-hidden rounded-[1.35rem] shadow-[inset_0_0_0_2.5px_rgb(10,10,10)] sm:shadow-[inset_0_0_0_3px_rgb(10,10,10)]">
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-slate-100 via-sky-50/90 to-blue-100/80"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-pulse-accent/[0.09] via-transparent to-white/40"
            aria-hidden
          />
          {/* Dynamic Island–style camera bar */}
          <div
            className="pointer-events-none absolute left-1/2 top-2 z-[60] h-[22px] w-[min(34%,5.75rem)] min-w-[4.75rem] -translate-x-1/2 rounded-full bg-slate-800 shadow-[inset_0_1px_2px_rgba(255,255,255,0.14),0_2px_6px_rgba(0,0,0,0.35)] ring-1 ring-slate-950/50 sm:top-2.5 sm:h-6 sm:min-w-[5.25rem] sm:w-[min(36%,6rem)]"
            aria-hidden
          />
          <div className="relative z-10 flex h-full min-h-0 flex-col">
            <header className="relative shrink-0 overflow-hidden border-b border-white/25 pt-7 shadow-[inset_0_-1px_0_rgba(255,255,255,0.2)] sm:pt-8">
              {/* Background image — subtle, header only */}
              <div
                className="pointer-events-none absolute inset-0 z-0 scale-105 bg-cover bg-center blur-[1.5px]"
                style={{ backgroundImage: "url('/images/panorama.jpg')" }}
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/55 via-black/42 to-black/30"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-10 bg-gradient-to-t from-slate-100/40 via-slate-100/15 to-transparent"
                aria-hidden
              />

              <div className="relative z-10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-200" aria-hidden />
                    <span className="truncate text-sm font-medium text-white drop-shadow-sm">Panorama</span>
                  </div>
                  <button
                    type="button"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/95 backdrop-blur-sm transition-colors active:bg-white/20"
                    aria-label="Search"
                  >
                    <Search className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>

                <div className="mt-3 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-base font-semibold leading-tight tracking-tight text-white drop-shadow-md">
                      Hi, Deb!
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white shadow-md ring-2 ring-white/90 backdrop-blur-sm">
                      DH
                    </div>
                    <div className="flex flex-col items-center gap-0.5 text-center">
                      <p className="flex items-center gap-1 text-[10px] font-semibold leading-none text-white drop-shadow-sm">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-sm" aria-hidden />
                        On-site
                      </p>
                      <p className="text-[10px] font-medium leading-none text-white/80">Garage</p>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white/40 backdrop-blur-md backdrop-saturate-150">
              <div className="flex flex-col gap-4 p-4 pb-3">
                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-pulse-navy">Current Toolbox</h3>
                    <button type="button" className="text-xs font-medium text-pulse-accent active:opacity-80">
                      View All
                    </button>
                  </div>
                  <ul className="flex flex-col gap-2">
                    <li>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left transition-colors active:bg-slate-50"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-pulse-accent">
                          <Disc3 className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-pulse-navy">Circular Saw</p>
                          <p className="text-sm text-pulse-muted">Ready · Blade guard OK</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left transition-colors active:bg-slate-50"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-pulse-accent">
                          <Drill className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-pulse-navy">Drill</p>
                          <p className="text-sm text-pulse-muted">Charged · 18V pack</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left transition-colors active:bg-slate-50"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-pulse-accent">
                          <Battery className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <p className="text-sm font-medium text-pulse-navy">Batteries (×2)</p>
                            <span className="text-sm font-medium text-emerald-700">Charged</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: "80%" }} />
                            </div>
                            <span className="text-xs tabular-nums text-pulse-muted">80%</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                      </button>
                    </li>
                  </ul>
                </section>

                <div className="rounded-md border border-indigo-200/70 bg-gradient-to-br from-sky-50 via-blue-50/95 to-indigo-100/40 p-5 shadow-md shadow-indigo-900/10 ring-1 ring-indigo-100/80">
                  <p className="text-xs font-semibold leading-snug text-pulse-navy">
                    Tools you have are commonly associated with Carpentry.
                  </p>
                  <p className="mt-2 text-xs leading-snug text-pulse-muted">
                    Are you working on: <span className="font-bold text-indigo-950">WR#1953</span>
                  </p>
                  <button
                    type="button"
                    className="mt-4 flex h-10 w-full items-center justify-center rounded-md bg-pulse-accent text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-colors active:bg-pulse-accent-hover"
                  >
                    Confirm
                  </button>
                  <p className="mt-2.5 text-center text-[11px] font-medium tabular-nums leading-snug text-indigo-900/80">
                    Current time on task: 1h 32m
                  </p>
                </div>
              </div>
            </div>

            <nav className="relative z-10 flex h-14 shrink-0 items-center justify-between border-t border-white/35 bg-gradient-to-t from-blue-50/75 via-white/65 to-white/55 px-2 pb-1 pt-1 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <button
                type="button"
                className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-pulse-accent"
              >
                <span className="flex h-8 w-12 items-center justify-center rounded-lg bg-pulse-accent/15 ring-1 ring-pulse-accent/20 backdrop-blur-sm">
                  <Home className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <span className="text-[10px] font-semibold leading-none">Home</span>
              </button>
              <button
                type="button"
                className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-slate-600 active:bg-white/30"
              >
                <span className="flex h-8 w-12 items-center justify-center rounded-lg">
                  <Package className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <span className="text-[10px] font-medium leading-none">Toolbox</span>
              </button>
              <button
                type="button"
                className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-slate-600 active:bg-white/30"
              >
                <span className="flex h-8 w-12 items-center justify-center rounded-lg">
                  <Bell className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <span className="text-[10px] font-medium leading-none">Alerts</span>
              </button>
              <button
                type="button"
                className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-slate-600 active:bg-white/30"
              >
                <span className="flex h-8 w-12 items-center justify-center rounded-lg">
                  <User className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <span className="text-[10px] font-medium leading-none">Profile</span>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileFeatureSection() {
  return (
    <SectionWrapper id="worker-app" className="scroll-mt-24 bg-white/60" showMobileSeparator>
      <div className="grid items-center gap-8 md:gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="order-2 flex justify-center lg:order-1 lg:justify-start">
          <PhoneChrome />
        </div>

        <div className="order-1 mx-auto max-w-xl text-center lg:order-2 lg:mx-0 lg:text-left">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-pulse-navy md:text-4xl lg:text-[2.5rem]">
            Simple tools for the field.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-pulse-muted">
            Give your team what they need without slowing them down.
          </p>
          <ul className="mt-8 space-y-6 text-left">
            <FeatureItem title="Works offline when needed" description="Capture data in dead zones; sync resumes when coverage returns." />
            <FeatureItem title="View assigned work and tools" description="Open the app and see today&apos;s jobs and gear in one feed." />
            <FeatureItem title="Submit photos and confirmations" description="Attach proof and sign-offs without switching apps." />
            <FeatureItem title="Get updates as they happen" description="Assignments and changes show up without waiting for paper rounds." />
          </ul>
        </div>
      </div>
    </SectionWrapper>
  );
}
