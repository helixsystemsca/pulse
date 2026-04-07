"use client";

import { Layers, MapPin, Radio, Users } from "lucide-react";

const card =
  "rounded-md border border-slate-200/80 bg-white p-5 shadow-card dark:border-[#1F2937] dark:bg-[#0F172A] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]";

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
    <section className="rounded-md border border-slate-200/80 bg-white/90 p-5 shadow-card dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] md:p-6">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-[#2B4C7E] dark:text-sky-400" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-pulse-navy dark:text-gray-100">Assignments overview</h2>
          <p className="text-sm text-pulse-muted dark:text-gray-400">Workers, active tags, and zone coverage at a glance.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className={card}>
          <div className="flex items-center gap-2 text-pulse-navy dark:text-gray-100">
            <Users className="h-4 w-4 text-sky-700 dark:text-sky-400" aria-hidden />
            <h3 className="text-sm font-semibold">Workers</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {workers.length === 0 ? (
              <li className="text-pulse-muted dark:text-gray-500">No workers in roster.</li>
            ) : (
              workers.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-col rounded-lg bg-slate-50/90 px-3 py-2 ring-1 ring-slate-200/60 dark:bg-[#111827] dark:ring-[#374151]"
                >
                  <span className="font-medium text-pulse-navy dark:text-gray-100">{w.name}</span>
                  <span className="text-xs text-pulse-muted dark:text-gray-500">{w.tag ? `Tag: ${w.tag}` : "No tag assigned"}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-pulse-navy dark:text-gray-100">
            <Radio className="h-4 w-4 text-teal-800 dark:text-teal-400" aria-hidden />
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
            <p className="text-xs text-pulse-muted dark:text-gray-500">
              Worker tags are assigned here. Equipment tags are linked in{" "}
              <span className="font-medium text-pulse-navy dark:text-gray-200">Inventory</span>.
            </p>
          </div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-pulse-navy dark:text-gray-100">
            <MapPin className="h-4 w-4 text-indigo-800 dark:text-indigo-400" aria-hidden />
            <h3 className="text-sm font-semibold">Zones &amp; gateways</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {zoneRows.length === 0 ? (
              <li className="text-pulse-muted dark:text-gray-500">No zones defined.</li>
            ) : (
              zoneRows.map((z) => (
                <li
                  key={z.id}
                  className="flex flex-col rounded-lg bg-slate-50/90 px-3 py-2 ring-1 ring-slate-200/60 dark:bg-[#111827] dark:ring-[#374151]"
                >
                  <span className="font-medium text-pulse-navy dark:text-gray-100">{z.name}</span>
                  <span className="text-xs text-pulse-muted dark:text-gray-500">
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
