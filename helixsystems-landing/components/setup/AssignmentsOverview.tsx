"use client";

import { Layers, MapPin, Radio, Users } from "lucide-react";

const card =
  "rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)]";

export function AssignmentsOverview({
  workers,
  zoneRows,
  tagSummary,
}: {
  workers: { id: string; name: string; tag: string | null }[];
  zoneRows: { id: string; name: string; gateways: string[] }[];
  tagSummary: { registered: number; assigned: number; unassigned: number };
}) {
  return (
    <section className="rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)] md:p-6">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-ds-foreground" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-ds-foreground">Assignments overview</h2>
          <p className="text-sm text-ds-muted">Workers, active tags, and zone coverage at a glance.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className={card}>
          <div className="flex items-center gap-2 text-ds-foreground">
            <Users className="h-4 w-4 text-ds-muted" aria-hidden />
            <h3 className="text-sm font-semibold">Workers</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {workers.length === 0 ? (
              <li className="text-ds-muted">No workers in roster.</li>
            ) : (
              workers.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-col rounded-lg bg-ds-secondary/60 px-3 py-2 ring-1 ring-ds-border"
                >
                  <span className="font-medium text-ds-foreground">{w.name}</span>
                  <span className="text-xs text-ds-muted">{w.tag ? `Tag: ${w.tag}` : "No tag assigned"}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-ds-foreground">
            <Radio className="h-4 w-4 text-ds-muted" aria-hidden />
            <h3 className="text-sm font-semibold">Active tags</h3>
          </div>
          <div className="mt-3 space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="app-badge-slate rounded-lg px-2 py-2">
                <p className="text-lg font-semibold tabular-nums">{tagSummary.registered}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">Registered</p>
              </div>
              <div className="app-badge-emerald rounded-lg px-2 py-2">
                <p className="text-lg font-semibold tabular-nums">{tagSummary.assigned}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">Assigned</p>
              </div>
              <div className="app-badge-amber rounded-lg px-2 py-2">
                <p className="text-lg font-semibold tabular-nums">{tagSummary.unassigned}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">Unassigned</p>
              </div>
            </div>
            <p className="text-xs text-ds-muted">
              Worker tags go to roster members; equipment tags attach to tracked assets on the{" "}
              <span className="font-medium text-ds-foreground">Gateways &amp; sensors</span> tab.
            </p>
          </div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-ds-foreground">
            <MapPin className="h-4 w-4 text-ds-muted" aria-hidden />
            <h3 className="text-sm font-semibold">Zones &amp; gateways</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {zoneRows.length === 0 ? (
              <li className="text-ds-muted">No zones defined.</li>
            ) : (
              zoneRows.map((z) => (
                <li
                  key={z.id}
                  className="flex flex-col rounded-lg bg-ds-secondary/60 px-3 py-2 ring-1 ring-ds-border"
                >
                  <span className="font-medium text-ds-foreground">{z.name}</span>
                  <span className="text-xs text-ds-muted">
                    {z.gateways.length ? z.gateways.join(", ") : "No gateways assigned"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
