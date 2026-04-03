"use client";

import { Layers, MapPin, Package, Users } from "lucide-react";

const card = "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card";

export function AssignmentsOverview({
  workers,
  equipmentRows,
  zoneRows,
}: {
  workers: { id: string; name: string; tag: string | null }[];
  equipmentRows: { id: string; name: string; tag: string | null }[];
  zoneRows: { id: string; name: string; gateways: string[] }[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-card md:p-6">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-[#2B4C7E]" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-pulse-navy">Assignments overview</h2>
          <p className="text-sm text-pulse-muted">Workers, assets, and coverage at a glance.</p>
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
            <Package className="h-4 w-4 text-amber-800" aria-hidden />
            <h3 className="text-sm font-semibold">Equipment</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {equipmentRows.length === 0 ? (
              <li className="text-pulse-muted">No equipment records.</li>
            ) : (
              equipmentRows.map((e) => (
                <li key={e.id} className="flex flex-col rounded-lg bg-slate-50/90 px-3 py-2 ring-1 ring-slate-200/60">
                  <span className="font-medium text-pulse-navy">{e.name}</span>
                  <span className="text-xs text-pulse-muted">{e.tag ? `Linked: ${e.tag}` : "Not linked"}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-pulse-navy">
            <MapPin className="h-4 w-4 text-indigo-800" aria-hidden />
            <h3 className="text-sm font-semibold">Zones & gateways</h3>
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
