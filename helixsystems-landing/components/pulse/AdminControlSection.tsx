import {
  AlertTriangle,
  Battery,
  Eye,
  LayoutDashboard,
  MapPin,
  Radio,
  Shield,
} from "lucide-react";
import { SectionWrapper } from "./SectionWrapper";

type ActiveRosterRole = "worker" | "lead" | "supervisor";

const roleBadgeBase =
  "pointer-events-none absolute -bottom-0.5 -right-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-white";

function onsiteAvatarClass(role: ActiveRosterRole) {
  const shared =
    "relative shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-900 shadow-md ring-2 ring-emerald-500/55 ring-offset-2 ring-offset-white transition-transform";
  if (role === "lead") {
    return `z-[1] flex h-14 w-14 text-base shadow-lg ring-[3px] ring-emerald-600 md:h-16 md:w-16 md:text-lg ${shared}`;
  }
  return `flex h-11 w-11 text-xs shadow-sm md:h-12 md:w-12 md:text-sm ${shared}`;
}

function offsiteAvatarClass() {
  return "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-950 shadow-sm ring-2 ring-amber-500/45 ring-offset-2 ring-offset-white md:h-12 md:w-12 md:text-sm";
}

function absentAvatarClass() {
  return "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-800 opacity-[0.88] shadow-sm ring-2 ring-red-400/65 ring-offset-2 ring-offset-white after:absolute after:bottom-0 after:right-0 after:z-10 after:h-2.5 after:w-2.5 after:rounded-full after:bg-red-500 after:ring-2 after:ring-white md:h-11 md:w-11 md:text-sm";
}

function DashboardMock() {
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const onsiteRoster: { initials: string; role: ActiveRosterRole; title: string }[] = [
    { initials: "MR", role: "lead", title: "Site lead · On-site" },
    { initials: "AR", role: "supervisor", title: "Supervisor · On-site" },
    { initials: "JA", role: "worker", title: "Technician · On-site" },
    { initials: "LS", role: "worker", title: "Technician · On-site" },
    { initials: "NT", role: "worker", title: "Technician · On-site" },
    { initials: "KP", role: "worker", title: "Technician · On-site" },
  ];

  const offsiteRoster: { initials: string; title: string }[] = [
    { initials: "RW", title: "Technician · Off-site (Site B)" },
    { initials: "EB", title: "Technician · Off-site (vendor call)" },
  ];

  const absentRoster: { initials: string; title: string }[] = [
    { initials: "DM", title: "Absent · Sick (unavailable)" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-pulse-border bg-white shadow-lg ring-1 ring-slate-900/[0.05]">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-pulse-border bg-slate-50/80 px-4 py-4 sm:px-6">
        <span className="min-w-0 text-base font-bold leading-tight tracking-tight text-pulse-navy sm:text-lg md:text-xl lg:text-2xl">
          Panorama Dashboard
        </span>
        <div className="flex justify-center">
          <img
            src="/images/panologo.png"
            alt="Panorama"
            className="h-7 w-auto max-w-[min(100%,11rem)] object-contain object-center md:h-8"
          />
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <p className="min-w-0 truncate text-xs text-pulse-muted sm:text-sm">
            Welcome,{" "}
            <span className="font-semibold text-pulse-navy">Liz Gregg</span>
          </p>
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-pulse-accent ring-2 ring-white">
            LG
            <span
              className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-pulse-accent text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-white"
              aria-hidden
            >
              M
            </span>
          </span>
        </div>
      </header>

      <div className="grid gap-4 bg-gradient-to-br from-white to-slate-50/90 p-5 lg:grid-cols-12 lg:p-6">
        <section
          className="flex flex-col rounded-2xl border border-pulse-border bg-white p-5 shadow-sm lg:col-span-12 lg:p-6"
          data-dashboard-tile="alerts"
        >
          <h3 className="text-base font-bold text-pulse-navy">Active Alerts</h3>
          <ul className="mt-4 flex flex-1 flex-col gap-3">
            <li className="flex gap-3 rounded-xl border border-red-100 bg-red-50/50 p-4">
              <span className="mt-0.5 flex h-9 w-1 shrink-0 rounded-full bg-red-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-pulse-navy">Missing Hammer Drill</p>
                <p className="mt-1 text-xs leading-relaxed text-pulse-muted">
                  Last seen: Boiler Room
                  <br />
                  Zone 3 (Garage)
                </p>
              </div>
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
            </li>
            <li className="flex gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
              <span className="mt-0.5 flex h-9 w-1 shrink-0 rounded-full bg-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-pulse-navy">Zone 3 (Garage) Offline</p>
                <p className="mt-1 text-xs text-pulse-muted">
                  Status: <span className="font-semibold text-amber-900">Planned</span>
                </p>
              </div>
              <Radio className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            </li>
            <li className="flex gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
              <span className="mt-0.5 flex h-9 w-1 shrink-0 rounded-full bg-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-pulse-navy">Low Beacon Battery</p>
                <p className="mt-1 text-xs text-pulse-muted">
                  Zone 2 anchor · swap pack before next shift
                </p>
              </div>
              <Radio className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            </li>
          </ul>
        </section>

        <section
          className="flex flex-col rounded-2xl border border-pulse-border bg-white p-5 shadow-sm lg:col-span-5 lg:min-h-[280px] lg:p-6"
          data-dashboard-tile="workforce"
        >
          <h3 className="text-base font-bold text-pulse-navy">Workforce</h3>
          <p className="mt-2 text-sm font-semibold text-pulse-navy">Today – {todayLabel}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-pulse-muted">
            <span className="font-semibold text-pulse-navy">9 Scheduled</span>
            <span className="text-pulse-border" aria-hidden>
              ·
            </span>
            <span>1 Lead</span>
            <span className="text-pulse-border" aria-hidden>
              ·
            </span>
            <span>1 Supervisor</span>
            <span className="text-pulse-border" aria-hidden>
              ·
            </span>
            <span>6 On-site</span>
            <span className="text-pulse-border" aria-hidden>
              ·
            </span>
            <span className="text-amber-800/90">2 Off-site</span>
            <span className="text-pulse-border" aria-hidden>
              ·
            </span>
            <span className="text-red-700/90">1 Sick</span>
          </p>

          <div className="mt-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800/90">
                  On-site
                </p>
                <div className="flex flex-wrap gap-3">
                  {onsiteRoster.map(({ initials, role, title }) => (
                    <span key={initials} title={title} className={onsiteAvatarClass(role)}>
                      {initials}
                      {role === "lead" ? (
                        <span className={`${roleBadgeBase} bg-emerald-700`}>L</span>
                      ) : null}
                      {role === "supervisor" ? (
                        <span className={`${roleBadgeBase} bg-pulse-accent`}>S</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/90">
                  Off-site
                </p>
                <div className="flex flex-wrap gap-3">
                  {offsiteRoster.map(({ initials, title }) => (
                    <span key={initials} title={title} className={offsiteAvatarClass()}>
                      {initials}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t border-pulse-border pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Absent</p>
              <div className="mt-3 flex gap-3">
                {absentRoster.map(({ initials, title }) => (
                  <span key={initials} title={title} className={absentAvatarClass()}>
                    {initials}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-pulse-border pt-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              On-site · 6
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Off-site · 2
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800 ring-1 ring-red-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Sick · 1
            </span>
          </div>
        </section>

        <section
          className="rounded-2xl border border-pulse-border bg-white p-5 shadow-sm lg:col-span-7 lg:p-6"
          data-dashboard-tile="work-requests"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-base font-bold text-pulse-navy">Work Requests</h3>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold tracking-tight text-amber-950 ring-1 ring-amber-200/80">
              7 requests awaiting assignment
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">Newest</p>
              <div className="mt-2 rounded-xl border border-pulse-border bg-slate-50/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-pulse-navy">Cooling Pump Skid 7</p>
                    <p className="mt-1 text-xs text-pulse-muted">Seal leak on secondary — WR-8910</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-pulse-accent ring-1 ring-blue-100">
                    In progress
                  </span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">Oldest</p>
              <div className="mt-2 rounded-xl border border-pulse-border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-pulse-navy">Industrial Lift 2</p>
                    <p className="mt-1 text-xs text-pulse-muted">Annual inspection certification · WR-8894</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900 ring-1 ring-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Overdue
                  </span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700/90">
                High priority / Critical
              </p>
              <ul className="mt-2 flex flex-col gap-3">
                {[
                  {
                    asset: "Sprinkler Test Riser",
                    desc: "Quarterly flow test documentation pending · WR-8755",
                  },
                  {
                    asset: "HVAC Compressor #4",
                    desc: "Vibration past threshold — bearing inspection · WR-8921",
                  },
                  {
                    asset: "Main Power Panel",
                    desc: "Thermal scan follow-up escalated · WR-8840",
                  },
                ].map((row) => (
                  <li
                    key={row.asset}
                    className="flex gap-3 rounded-xl border border-red-100 bg-red-50/35 p-3 ring-1 ring-red-100/60"
                  >
                    <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-red-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-pulse-navy">{row.asset}</p>
                      <p className="mt-0.5 text-xs text-pulse-muted">{row.desc}</p>
                    </div>
                    <span className="shrink-0 self-start rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Urgent
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          className="flex flex-col rounded-2xl border border-pulse-border bg-white p-5 shadow-sm lg:col-span-6"
          data-dashboard-tile="equipment"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
            Equipment Update
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-pulse-navy md:text-3xl">67 Active Tools</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              2 Missing
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 ring-1 ring-red-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              1 Out of Service
            </span>
          </div>
          <div className="mt-4 flex flex-1 flex-col gap-4 border-t border-pulse-border pt-4">
            <div className="rounded-xl border border-amber-200/90 bg-amber-50/50 p-4 shadow-sm">
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <MapPin className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-pulse-navy">
                    Several tools are accounted for, but in the wrong zones.
                  </p>
                  <p className="mt-1 text-xs text-pulse-muted">Schedule a clean up?</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-pulse-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-pulse-accent-hover"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-pulse-navy shadow-sm transition-colors hover:bg-slate-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-slate-700 shadow-sm">
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200/80">
                  <Battery className="h-4 w-4" aria-hidden />
                </span>
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-pulse-navy">
                  Batteries 3, 4, and 6 should be fully charged and ready to be swapped.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="flex flex-col rounded-2xl border border-pulse-border bg-white p-5 shadow-sm lg:col-span-6"
          data-dashboard-tile="inventory"
        >
          <h3 className="text-base font-bold text-pulse-navy">Inventory Status</h3>
          <div className="mt-4 flex flex-1 flex-col gap-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-pulse-border bg-slate-50/50 p-4">
              <div>
                <p className="text-sm font-semibold text-pulse-navy">Consumables</p>
                <p className="mt-1 text-xs text-pulse-muted">Stock within target range</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                OK
              </span>
            </div>

            <div className="rounded-xl border border-pulse-border bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">
                Inventory Alert
              </p>
              <div className="mt-3 flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/30 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-pulse-navy">Plumbing</p>
                  <p className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-900">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    Resupply needed in 7 days
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
                  Soon
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-pulse-navy shadow-sm transition-colors hover:bg-slate-50"
                >
                  Add to List
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-pulse-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-pulse-accent-hover"
                >
                  Order Now
                </button>
              </div>
            </div>

            <div className="border-t border-pulse-border pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">
                Shopping List
              </p>
              <ul className="mt-3 space-y-2">
                {["Plumbing fittings", "Pipe sealant", "Replacement valves"].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-pulse-navy"
                  >
                    <span
                      className="flex h-4 w-4 shrink-0 rounded border border-slate-300 bg-white"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-pulse-border bg-slate-50/60 px-6 py-3 text-center text-xs font-medium text-pulse-muted">
        Powered by Helix Systems
      </footer>
    </div>
  );
}

export function AdminControlSection() {
  return (
    <SectionWrapper id="admin-panel" className="scroll-mt-24 bg-pulse-bg">
      <div className="mx-auto max-w-3xl text-center md:max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight text-pulse-navy md:text-4xl">
          See everything in one place.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-pulse-muted">
          Monitor work, tools, and workforce across your operation.
        </p>
      </div>

      <div className="relative mx-auto mt-10 max-w-5xl md:mt-14">
        <DashboardMock />
      </div>

      <div
        id="features"
        className="mx-auto mt-12 grid max-w-5xl scroll-mt-24 gap-8 md:mt-16 md:grid-cols-3 md:gap-12"
      >
        <div className="text-center md:text-left">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-pulse-accent md:mx-0">
            <LayoutDashboard className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-lg font-semibold text-pulse-navy">Active work and alerts</h3>
          <p className="mt-2 text-sm leading-relaxed text-pulse-muted">
            Open work requests, exceptions, and queue depth stay visible on the home dashboard.
          </p>
        </div>
        <div className="text-center md:text-left">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-pulse-accent md:mx-0">
            <Eye className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-lg font-semibold text-pulse-navy">Tool and asset status</h3>
          <p className="mt-2 text-sm leading-relaxed text-pulse-muted">
            In-use, idle, and missing flags update as the floor reports them—no clipboard audit required.
          </p>
        </div>
        <div className="text-center md:text-left">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-pulse-accent md:mx-0">
            <Shield className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-lg font-semibold text-pulse-navy">Users, roles, and company settings</h3>
          <p className="mt-2 text-sm leading-relaxed text-pulse-muted">
            Invite workers, set admin vs. manager vs. worker access, and tune company-level options from one admin surface.
          </p>
        </div>
      </div>
    </SectionWrapper>
  );
}
