import {
  AlertTriangle,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  MoreHorizontal,
  Search,
  Settings2,
  SlidersHorizontal,
  Users,
  Wrench,
} from "lucide-react";
import { FeatureItem } from "./FeatureItem";
import { SectionWrapper } from "./SectionWrapper";

function CmmsDesktopChrome() {
  return (
    <div className="relative mx-auto w-full max-w-[1100px] lg:mx-0">
      <div className="rounded-2xl bg-gradient-to-b from-slate-500 via-slate-700 to-slate-900 p-[3px] shadow-2xl shadow-slate-900/35 ring-1 ring-white/12">
        <div className="relative flex min-h-[min(28rem,55vw)] overflow-hidden rounded-[1.05rem] bg-slate-100 md:min-h-[26rem] lg:min-h-[28.5rem] xl:min-h-[31rem]">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.11)_1px,transparent_1px)] [background-size:12px_12px]"
            aria-hidden
          />
          <aside className="relative z-10 flex w-12 shrink-0 flex-col items-center gap-3 border-r border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100/95 py-4 md:w-14">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pulse-accent text-white shadow-md shadow-blue-600/25">
              <LayoutDashboard className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500">
              <ClipboardList className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500">
              <Wrench className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500">
              <Users className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <div className="flex-1" />
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400">
              <Settings2 className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
          </aside>

          <div className="relative z-10 flex min-w-0 flex-1 flex-col bg-gradient-to-br from-white via-slate-50/40 to-blue-50/30">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/90 bg-white/90 px-3 py-2.5 backdrop-blur-md md:px-4 md:py-3">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-sm font-bold tracking-tight text-pulse-navy md:text-base">
                  Work Requests
                </h3>
                <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:inline">
                  CMMS
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 shadow-sm md:h-9 md:px-3">
                  <Search className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} aria-hidden />
                  <span className="text-xs text-slate-400">Search orders…</span>
                </div>
                <button
                  type="button"
                  className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-pulse-navy shadow-sm md:h-9 md:px-2.5"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                  <span className="hidden sm:inline">Filters</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" aria-hidden />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden p-3 md:p-4">
              <div
                className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-red-100 bg-red-50/90 px-3 py-2 shadow-sm ring-1 ring-red-100/80"
                role="status"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                <p className="min-w-0 flex-1 text-xs font-semibold leading-snug text-red-950 md:text-sm">
                  3 critical tasks unassigned · escalated from night shift
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
                >
                  Assign
                </button>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {["Open", "In progress", "On hold"].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm"
                  >
                    {label}
                  </span>
                ))}
                <span className="rounded-full border border-blue-200 bg-pulse-accent/10 px-2.5 py-1 text-[11px] font-semibold text-pulse-accent ring-1 ring-pulse-accent/20">
                  This week
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-md shadow-slate-900/[0.06] ring-1 ring-slate-900/[0.04] [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
                <div className="min-w-[520px]">
                <div className="grid grid-cols-[1fr_0.85fr_0.65fr_0.55fr] gap-2 border-b border-slate-100 bg-slate-50/90 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 md:gap-3 md:px-4 md:text-[11px]">
                  <span>Work order</span>
                  <span className="hidden sm:block">Asset</span>
                  <span>Status</span>
                  <span className="text-right">Priority</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {[
                    {
                      wo: "WR-8921",
                      title: "Cooling Pump Skid 7",
                      asset: "Mechanical · B-wing",
                      status: "In progress",
                      statusClass: "bg-blue-50 text-blue-800 ring-blue-100",
                      pri: "High",
                      priClass: "text-amber-800",
                    },
                    {
                      wo: "WR-8894",
                      title: "Industrial Lift 2",
                      asset: "Elevators",
                      status: "Overdue",
                      statusClass: "bg-amber-50 text-amber-900 ring-amber-100",
                      pri: "Med",
                      priClass: "text-slate-700",
                    },
                    {
                      wo: "WR-8755",
                      title: "Sprinkler test riser",
                      asset: "Life safety",
                      status: "Unassigned",
                      statusClass: "bg-slate-100 text-slate-700 ring-slate-200/80",
                      pri: "Critical",
                      priClass: "text-red-700 font-bold",
                    },
                    {
                      wo: "WR-8840",
                      title: "Main power panel",
                      asset: "Electrical",
                      status: "Scheduled",
                      statusClass: "bg-emerald-50 text-emerald-800 ring-emerald-100",
                      pri: "High",
                      priClass: "text-amber-800",
                    },
                  ].map((row) => (
                    <li key={row.wo} className="grid grid-cols-[1fr_0.85fr_0.65fr_0.55fr] items-center gap-2 px-3 py-2.5 md:gap-3 md:px-4 md:py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-pulse-navy md:text-sm">{row.title}</p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500 md:text-xs">{row.wo}</p>
                      </div>
                      <p className="hidden min-w-0 truncate text-xs text-pulse-muted sm:block">{row.asset}</p>
                      <span
                        className={`inline-flex w-fit max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 md:text-[11px] ${row.statusClass}`}
                      >
                        {row.status}
                      </span>
                      <span className={`text-right text-[10px] font-semibold md:text-xs ${row.priClass}`}>
                        {row.pri}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-2 md:px-4">
                  <p className="text-[10px] text-slate-500 md:text-xs">Showing 1–4 of 47</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm"
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      aria-label="Row actions"
                      className="ml-1 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkRequestsFeatureSection() {
  return (
    <SectionWrapper id="work-requests" className="scroll-mt-24 bg-white/60">
      <div className="grid items-start gap-8 md:gap-10 lg:grid-cols-12 lg:gap-8 xl:gap-10">
        <div className="order-2 mx-auto max-w-xl text-center lg:order-1 lg:col-span-5 lg:mx-0 lg:max-w-none lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">Work requests</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-pulse-navy md:text-4xl">
            Manage work from start to finish.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-pulse-muted md:text-lg">
            Create, assign, and track work without losing visibility.
          </p>
          <ul className="mt-8 space-y-5 text-left">
            <FeatureItem title="Create and assign work requests" />
            <FeatureItem title="Track status (open, in progress, complete)" />
            <FeatureItem title="Prioritize critical work" description="Keep urgent jobs at the top so nothing critical sits in the queue." />
            <FeatureItem title="See what is delayed or unassigned" description="Spot stuck tickets before they become downtime or customer issues." />
          </ul>
        </div>

        <div className="order-1 flex min-w-0 justify-center lg:order-2 lg:col-span-7 lg:justify-end">
          <CmmsDesktopChrome />
        </div>
      </div>
    </SectionWrapper>
  );
}
