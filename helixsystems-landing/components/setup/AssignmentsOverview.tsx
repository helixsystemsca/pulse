"use client";

import { Layers, MapPin, Radio, Users } from "lucide-react";

const card = "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card";

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
    <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-card md:p-6">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-[#2B4C7E]" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-pulse-navy">Assignments overview</h2>
          <p className="text-sm text-pulse-muted">Workers, active tags, and zone coverage at a glance.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className={card}>
          <div className="flex items-center gap-2 text-pulse-navy">
            <Users className="h-4 w-4 text-sky-700" aria-hidden />
            <h3 className="text-sm font-semibold">Workers</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {workers.length === 0 ? (
              <li className="text-pulse-muted">No workers in roster.</li>
            ) : (
              workers.map((w) => (
                <li key={w.id} className="flex flex-col rounded-lg bg-slate-50/90 px-3 py-2 ring-1 ring-slate-200/60">
                  <span className="font-medium text-pulse-navy">{w.name}</span>
                  <span className="text-xs text-pulse-muted">{w.tag ? `Tag: ${w.tag}` : "No tag assigned"}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-pulse-navy">
            <Radio className="h-4 w-4 text-teal-800" aria-hidden />
            <h3 className="text-sm font-semibold">Active tags</h3>
          </div>
          <div className="mt-3 space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50/90 px-2 py-2 ring-1 ring-slate-200/60">
                <p className="text-lg font-semibold text-pulse-navy">{tagSummary.registered}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-pulse-muted">Registered</p>
              </div>
              <div className="rounded-lg bg-emerald-50/80 px-2 py-2 ring-1 ring-emerald-200/60">
                <p className="text-lg font-semibold text-emerald-900">{tagSummary.assigned}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-900/70">Assigned</p>
              </div>
              <div className="rounded-lg bg-amber-50/80 px-2 py-2 ring-1 ring-amber-200/60">
                <p className="text-lg font-semibold text-amber-950">{tagSummary.unassigned}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/70">Unassigned</p>
              </div>
            </div>
            <p className="text-xs text-pulse-muted">
              Worker tags are assigned here. Equipment tags are linked in{" "}
              <span className="font-medium text-pulse-navy">Inventory</span>.
            </p>
          </div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-pulse-navy">
            <MapPin className="h-4 w-4 text-indigo-800" aria-hidden />
            <h3 className="text-sm font-semibold">Zones &amp; gateways</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {zoneRows.length === 0 ? (
              <li className="text-pulse-muted">No zones defined.</li>
            ) : (
              zoneRows.map((z) => (
                <li key={z.id} className="flex flex-col rounded-lg bg-slate-50/90 px-3 py-2 ring-1 ring-slate-200/60">
                  <span className="font-medium text-pulse-navy">{z.name}</span>
                  <span className="text-xs text-pulse-muted">
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
