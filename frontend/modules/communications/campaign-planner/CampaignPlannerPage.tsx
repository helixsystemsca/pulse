"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { CommunicationsModuleShell } from "@/components/communications/CommunicationsModuleShell";
import { CampaignCard } from "@/components/communications/CampaignCard";
import { CommunicationsPanel } from "@/components/communications/CommunicationsPanel";
import { TimelineCard } from "@/components/communications/TimelineCard";
import { StatusBadge } from "@/components/communications/StatusBadge";
import { MOCK_CALENDAR_LAYER, MOCK_CAMPAIGNS, MOCK_CROSS_DEPT_REQUESTS } from "@/modules/communications/mock-data";
import type { CalendarLayerItem, Campaign } from "@/modules/communications/types";
import { cn } from "@/lib/cn";

function monthLabel(d: Date): string {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function layerAccent(k: CalendarLayerItem["kind"]): CalendarLayerItem["accent"] {
  if (k === "campaign") return "sky";
  if (k === "event") return "violet";
  if (k === "facility_notice") return "amber";
  return "rose";
}

export function CampaignPlannerPage() {
  const [cursor, setCursor] = useState(() => new Date(2026, 4, 1));
  const [selected, setSelected] = useState<Campaign | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const dim = daysInMonth(year, month);
  const days = useMemo(() => Array.from({ length: dim }, (_, i) => i + 1), [dim]);

  const campaignsInMonth = useMemo(
    () =>
      MOCK_CAMPAIGNS.filter((c) => {
        const s = new Date(c.startDate);
        const e = new Date(c.endDate);
        const first = new Date(year, month, 1);
        const last = new Date(year, month, dim);
        return s <= last && e >= first;
      }),
    [year, month, dim],
  );

  const layersInMonth = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month, dim);
    return MOCK_CALENDAR_LAYER.filter((L) => {
      const s = new Date(L.startDate);
      const e = new Date(L.endDate);
      return s <= last && e >= first;
    });
  }, [year, month, dim]);

  return (
    <CommunicationsModuleShell
      title="Long-term social & campaign planner"
      description="Seasonal visibility, cross-department coordination, and workflow tracking — not a publishing console."
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <CardShell>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Planning horizon</p>
                <h2 className="text-lg font-bold text-ds-foreground">{monthLabel(cursor)}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-ds-border px-3 py-1.5 text-sm font-medium hover:bg-ds-secondary"
                  onClick={() => setCursor(new Date(year, month - 1, 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-ds-border px-3 py-1.5 text-sm font-medium hover:bg-ds-secondary"
                  onClick={() => setCursor(new Date(year, month + 1, 1))}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <div className="flex min-w-max gap-1 pb-2">
                {days.map((day) => {
                  const dow = new Date(year, month, day).getDay();
                  const label = ["S", "M", "T", "W", "T", "F", "S"][dow];
                  const isToday = year === 2026 && month === 4 && day === 12;
                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex h-14 w-11 flex-col items-center justify-center rounded-xl border text-xs",
                        isToday
                          ? "border-[var(--ds-accent)] bg-[var(--ds-accent)]/10 font-bold text-ds-foreground"
                          : "border-ds-border/80 bg-ds-secondary/20 text-ds-muted",
                      )}
                    >
                      <span className="text-[10px]">{label}</span>
                      <span className="text-sm font-semibold text-ds-foreground">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-2 text-xs text-ds-muted">
              Hybrid month strip + campaign lanes — future: ICS feeds, facility master calendar, and approval states.
            </p>
          </CardShell>

          <div>
            <h3 className="text-sm font-bold text-ds-foreground">Campaigns this month</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {campaignsInMonth.map((c) => (
                <CampaignCard key={c.id} campaign={c} onOpen={setSelected} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-ds-foreground">Combined calendar layer</h3>
            <p className="mt-1 text-xs text-ds-muted">Campaigns, events, notices, and closures in one operational view.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {layersInMonth.map((L) => (
                <TimelineCard
                  key={L.id}
                  title={L.title}
                  subtitle={L.kind.replace(/_/g, " ")}
                  rangeLabel={`${L.startDate} → ${L.endDate}`}
                  accent={L.accent ?? layerAccent(L.kind)}
                  draggable
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <CommunicationsPanel title="Cross-department requests" description="Intake queue for comms work — workflow engine later.">
            <ul className="space-y-3">
              {MOCK_CROSS_DEPT_REQUESTS.map((r) => (
                <li key={r.id} className="rounded-xl border border-ds-border bg-ds-secondary/20 p-3 text-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">{r.fromDepartment}</p>
                  <p className="mt-1 font-medium text-ds-foreground">{r.summary}</p>
                  <p className="mt-2 text-xs text-ds-muted">
                    {r.status.replace("_", " ")} · logged {r.createdAt}
                  </p>
                </li>
              ))}
            </ul>
          </CommunicationsPanel>

          <CommunicationsPanel title="At a glance" tone="muted" description="Operational snapshot (mock).">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ds-muted">Active campaigns</dt>
                <dd className="font-semibold text-ds-foreground">{MOCK_CAMPAIGNS.length}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ds-muted">Open requests</dt>
                <dd className="font-semibold text-ds-foreground">
                  {MOCK_CROSS_DEPT_REQUESTS.filter((x) => x.status === "open").length}
                </dd>
              </div>
            </dl>
          </CommunicationsPanel>
        </div>
      </div>

      <AnimatePresence>
        {selected ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black"
              aria-label="Close drawer"
              onClick={() => setSelected(null)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md flex-col border-l border-ds-border bg-ds-primary shadow-2xl"
            >
              <div className="flex items-start justify-between gap-2 border-b border-ds-border px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">{selected.department}</p>
                  <h2 className="text-lg font-bold leading-tight text-ds-foreground">{selected.title}</h2>
                  <p className="mt-1 text-xs text-ds-muted">
                    {selected.startDate} → {selected.endDate}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 text-ds-muted hover:bg-ds-secondary hover:text-ds-foreground"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge variant="campaign" status={selected.status} size="md" />
                </div>
                {selected.description ? <p className="mt-4 text-ds-muted">{selected.description}</p> : null}
                <section className="mt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-ds-muted">Channels</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.channels.map((ch) => (
                      <span key={ch} className="rounded-full bg-ds-secondary px-2 py-0.5 text-xs font-medium">
                        {ch}
                      </span>
                    ))}
                  </div>
                </section>
                {selected.deadlines?.length ? (
                  <section className="mt-5">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-ds-muted">Deadlines</h3>
                    <ul className="mt-2 space-y-1 text-ds-foreground">
                      {selected.deadlines.map((d) => (
                        <li key={d.label} className="flex justify-between gap-2 text-sm">
                          <span>{d.label}</span>
                          <span className="text-ds-muted">{d.date}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                <section className="mt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-ds-muted">Assigned</h3>
                  <p className="mt-2 text-ds-foreground">{selected.assignedTo?.join(", ") ?? "—"}</p>
                </section>
                <section className="mt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-ds-muted">Linked assets</h3>
                  <ul className="mt-2 list-inside list-disc text-ds-muted">
                    {(selected.assets ?? []).length ? (
                      selected.assets!.map((a) => <li key={a}>{a}</li>)
                    ) : (
                      <li>None yet</li>
                    )}
                  </ul>
                </section>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </CommunicationsModuleShell>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-ds-border bg-ds-primary/90 p-4 shadow-[var(--ds-shadow-card)] sm:p-5">{children}</div>
  );
}
