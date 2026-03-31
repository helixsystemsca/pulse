import { Calendar, ClipboardList, Timer, Wrench } from "lucide-react";
import { SectionWrapper } from "./SectionWrapper";
import { SmallFeatureCard } from "./FeatureCard";

function DonutChart() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="relative h-32 w-32 rounded-full sm:h-36 sm:w-36"
        style={{
          background:
            "conic-gradient(rgb(37 99 235) 0% 82%, rgb(226 232 240) 82% 100%)",
        }}
      >
        <div className="absolute inset-[12px] flex flex-col items-center justify-center rounded-full bg-white sm:inset-[14px]">
          <span className="text-2xl font-bold text-pulse-navy sm:text-3xl">82%</span>
          <span className="text-xs font-medium text-pulse-muted">Optimal</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-pulse-navy">Asset Health</p>
    </div>
  );
}

export function MaintenanceSection() {
  return (
    <SectionWrapper className="bg-white/70">
      <div className="grid items-center gap-8 md:gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-pulse-accent">Maintenance</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-pulse-navy md:text-4xl lg:text-[2.35rem]">
            Stay ahead of equipment issues.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pulse-muted">
            Plan and track maintenance without relying on memory or spreadsheets.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-4">
            <SmallFeatureCard
              icon={<Calendar className="h-5 w-5" />}
              title="Schedule preventative maintenance"
              description="Calendar- or meter-based windows create tasks before failures show up on the line."
            />
            <SmallFeatureCard
              icon={<ClipboardList className="h-5 w-5" />}
              title="Track service history"
              description="Every visit, part swap, and sign-off stays on the asset record."
            />
            <SmallFeatureCard
              icon={<Wrench className="h-5 w-5" />}
              title="Standardize work processes"
              description="Repeatable checklists mean junior and veteran techs follow the same steps."
            />
            <SmallFeatureCard
              icon={<Timer className="h-5 w-5" />}
              title="Reduce unexpected downtime"
              description="Catch wear-and-tear work while it is cheap—not after an emergency stop."
            />
          </div>
        </div>

        <div className="rounded-2xl border border-pulse-border bg-white p-6 shadow-lg md:p-8">
          <div className="flex items-start justify-between border-b border-pulse-border pb-5">
            <div>
              <p className="text-sm font-semibold text-pulse-navy">Maintenance Hub</p>
              <p className="text-xs text-pulse-muted">Work order pipeline</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Live
            </span>
          </div>

          <div className="grid gap-8 py-6 sm:grid-cols-2 sm:items-center sm:gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
                Work Orders
              </p>
              <div className="mt-3 flex gap-8">
                <div>
                  <p className="text-2xl font-bold text-pulse-navy">24</p>
                  <p className="text-xs text-pulse-muted">Open</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-pulse-accent">114</p>
                  <p className="text-xs text-pulse-muted">Completed</p>
                </div>
              </div>
            </div>
            <DonutChart />
          </div>

          <div className="border-t border-pulse-border pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
              Upcoming Schedule
            </p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <span className="font-medium text-pulse-navy">Main Feed Pump Inspection</span>
                <span className="shrink-0 text-xs text-pulse-muted">Tue</span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <span className="font-medium text-pulse-navy">Precision Alignment · Line 2</span>
                <span className="shrink-0 text-xs text-pulse-muted">Thu</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
