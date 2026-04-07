import {
  ArrowLeft,
  Camera,
  Droplets,
  Keyboard,
  LayoutGrid,
  MapPin,
  Package,
  QrCode,
  Settings,
  Wrench,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { FeatureItem } from "./FeatureItem";
import { SectionWrapper } from "./SectionWrapper";

function BottomNav() {
  return (
    <nav className="flex h-11 shrink-0 items-stretch border-t border-slate-200 bg-white px-2">
      {[
        { Icon: LayoutGrid, label: "Dashboard" },
        { Icon: Wrench, label: "Assets" },
        { Icon: QrCode, label: "Scan", active: true },
        { Icon: Settings, label: "Settings" },
      ].map(({ Icon, label, active }) => (
        <button
          key={label}
          type="button"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1 ${active ? "text-white" : "text-slate-500"}`}
        >
          <span
            className={`flex h-7 w-10 items-center justify-center rounded-full ${active ? "bg-pulse-navy shadow-sm shadow-slate-900/20" : ""}`}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? "text-white" : ""}`} strokeWidth={2} aria-hidden />
          </span>
          <span className={`text-[7px] font-bold uppercase tracking-wide ${active ? "text-pulse-navy" : "text-slate-500"}`}>
            {label}
          </span>
        </button>
      ))}
    </nav>
  );
}

/** Equipment Setup screen tuned for landscape tablet density (embedded in frame). */
function EquipmentSetupScreen() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100 text-pulse-navy">
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 py-1.5">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-pulse-navy hover:bg-slate-100"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-pulse-navy">Equipment Setup</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden p-2">
        <div className="grid h-full grid-cols-2 gap-2 min-[480px]:gap-3">
          {/* Left column */}
          <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto overflow-x-hidden">
            <div className="flex gap-1.5">
              <button
                type="button"
                className="relative flex flex-1 items-center justify-center gap-1 rounded-md bg-pulse-navy px-2 py-2 text-[10px] font-bold text-white shadow-md shadow-slate-900/25 ring-2 ring-white/25 ring-offset-1 ring-offset-slate-100"
              >
                <QrCode className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                <span className="leading-tight">Scan QR / Barcode</span>
              </button>
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-200/80 px-2 py-2 text-[10px] font-bold text-pulse-navy"
              >
                <Keyboard className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                Manual
              </button>
            </div>

            <div>
              <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Equipment name</label>
              <input
                type="text"
                readOnly
                placeholder="e.g., Industrial Water Pump"
                className="mt-0.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-pulse-navy placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Asset ID</label>
              <input
                type="text"
                readOnly
                placeholder="e.g., PUMP-PR-001"
                className="mt-0.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-pulse-navy placeholder:text-slate-400"
              />
            </div>

            <div>
              <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Category</p>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {[
                  { label: "Mech / fluid", Icon: Droplets, on: true },
                  { label: "Electrical", Icon: Zap, on: false },
                  { label: "Tools", Icon: Wrench, on: false },
                  { label: "Other", Icon: Package, on: false },
                ].map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    className={`flex min-h-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1.5 text-center shadow-sm ${
                      c.on
                        ? "border-pulse-navy bg-pulse-navy text-white shadow-md shadow-slate-900/15"
                        : "border-slate-200 bg-white text-pulse-navy"
                    }`}
                  >
                    <c.Icon className={`h-4 w-4 ${c.on ? "text-white" : "text-slate-600"}`} strokeWidth={2} aria-hidden />
                    <span className="text-[9px] font-bold leading-tight">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto overflow-x-hidden">
            <section className="rounded-md border border-slate-200/80 bg-slate-200/40 p-2 shadow-sm">
              <div className="flex items-center gap-1 text-xs font-bold text-pulse-navy">
                <MapPin className="h-3.5 w-3.5 text-pulse-accent" strokeWidth={2} aria-hidden />
                Location &amp; Access
              </div>
              <label className="mt-1.5 block text-[8px] font-bold uppercase tracking-wider text-slate-500">Site / facility</label>
              <div className="mt-0.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-pulse-navy">
                Panorama
              </div>
              <label className="mt-1.5 block text-[8px] font-bold uppercase tracking-wider text-slate-500">Designated area</label>
              <div className="mt-0.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-pulse-navy">
                Pool Pump Room
              </div>
            </section>

            <section className="rounded-md border border-slate-200/80 bg-white p-2 shadow-sm">
              <p className="text-[10px] font-bold text-pulse-navy">Photo</p>
              <div className="relative mt-1 overflow-hidden rounded-md bg-slate-900">
                <div className="relative aspect-[16/10] w-full" aria-hidden>
                  <div
                    className="pointer-events-none absolute inset-0 z-0 scale-105 bg-cover bg-center blur-[1.5px]"
                    style={{ backgroundImage: "url('/images/pumps.avif')" }}
                  />
                  <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/55 via-black/42 to-black/30" />
                </div>
                <button
                  type="button"
                  className="absolute left-1/2 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-pulse-navy shadow-lg ring-2 ring-white/50"
                  aria-label="Capture photo"
                >
                  <Camera className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <p className="mt-1 text-center text-[9px] text-pulse-muted">Captured: Today, 10:45 AM</p>
            </section>

            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-pulse-navy">Authorized workers</span>
              <button type="button" className="text-[9px] font-bold text-pulse-accent">
                + Manage
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-pulse-navy">
                  DD
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[11px] font-bold text-pulse-navy">Daniel Dupree</p>
                  <p className="text-[8px] font-bold uppercase tracking-wide text-pulse-muted">Lead technician</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-pulse-navy">
                  MS
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[11px] font-bold text-pulse-navy">Mauro Sartori</p>
                  <p className="text-[8px] font-bold uppercase tracking-wide text-pulse-muted">Senior technician</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="relative mt-auto flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md bg-pulse-navy py-2.5 text-[11px] font-bold text-white shadow-lg shadow-slate-900/30 ring-2 ring-pulse-accent/35 ring-offset-2 ring-offset-slate-100"
            >
              <Zap className="h-4 w-4 text-amber-200" strokeWidth={2} aria-hidden />
              Assign &amp; Activate
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

function RuggedTabletFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[min(100%,700px)] origin-top max-md:-mb-10 max-md:max-w-[420px] max-md:scale-[0.78] sm:max-md:scale-[0.86] md:mb-0 md:max-w-[700px] md:scale-100">
      {/* Environmental backdrop */}
      <div
        className="pointer-events-none absolute -inset-[min(12%,5rem)] -z-10 rounded-[2.5rem] bg-gradient-to-br from-slate-400/35 via-slate-300/25 to-slate-500/40 blur-2xl"
        aria-hidden
      />

      <div className="relative rounded-3xl bg-gradient-to-b from-slate-600 via-slate-800 to-slate-950 p-2 shadow-2xl shadow-slate-950/45 ring-1 ring-white/10">
        {/* Corner bumpers */}
        <span
          className="pointer-events-none absolute -left-0.5 top-6 h-10 w-1.5 rounded-l-md bg-slate-900/90"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -right-0.5 bottom-8 h-14 w-1.5 rounded-r-md bg-slate-900/90"
          aria-hidden
        />

        <div className="aspect-[4/3] w-full">
          <div className="flex h-full flex-col rounded-md border border-slate-500/40 bg-slate-950 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            {/* Front camera / sensor */}
            <div className="relative flex h-4 shrink-0 items-end justify-center pb-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-700 ring-1 ring-slate-600/80" />
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[0.65rem] bg-slate-950">
              <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent" aria-hidden />
              <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.06]" aria-hidden />
              <div className="relative z-0 h-full w-full origin-top scale-[0.98]">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EquipmentSetupTabletSection() {
  return (
    <SectionWrapper
      id="equipment-setup"
      className="scroll-mt-24 bg-gradient-to-b from-white/80 via-pulse-bg to-slate-100/60"
      showMobileSeparator
    >
      <div className="grid items-center gap-8 md:gap-10 lg:grid-cols-12 lg:gap-8 xl:gap-10">
        <div className="order-1 mx-auto max-w-xl text-center lg:col-span-5 lg:mx-0 lg:max-w-none lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">Equipment setup</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-pulse-navy md:text-4xl">
            Add and organize your equipment quickly.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-pulse-muted md:text-lg">
            Get tools and assets into the system without spreadsheets or duplicate work.
          </p>
          <ul className="mt-8 space-y-5 text-left">
            <FeatureItem title="Scan or manually add equipment" />
            <FeatureItem title="Assign to zones or jobs" />
            <FeatureItem title="Link equipment to workers" description="Record who is responsible for or carrying each asset." />
            <FeatureItem title="Activate assets immediately" description="Turn records on as soon as onboarding is done." />
          </ul>
        </div>

        <div className="order-2 flex justify-center lg:col-span-7 lg:justify-end">
          <RuggedTabletFrame>
            <EquipmentSetupScreen />
          </RuggedTabletFrame>
        </div>
      </div>
    </SectionWrapper>
  );
}
