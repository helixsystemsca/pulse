"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Overview = {
  total_companies: number;
  active_companies: number;
  total_users: number;
  feature_usage: Record<string, number>;
};

export default function SystemOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const o = await apiFetch<Overview>("/api/system/overview");
        setData(o);
      } catch {
        setErr("Failed to load overview.");
      }
    })();
  }, []);

  if (err) return <p className="text-red-400">{err}</p>;
  if (!data) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Global overview</h1>
        <p className="mt-1 text-sm text-zinc-500">Internal platform metrics.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs font-medium uppercase text-zinc-500">Companies</p>
          <p className="mt-1 text-2xl font-semibold text-white">{data.total_companies}</p>
          <p className="text-xs text-zinc-500">{data.active_companies} active</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs font-medium uppercase text-zinc-500">Users</p>
          <p className="mt-1 text-2xl font-semibold text-white">{data.total_users}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs font-medium uppercase text-zinc-500">Feature adoption</p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {Object.entries(data.feature_usage).map(([k, v]) => (
              <li key={k}>
                <span className="text-zinc-300">{k}</span>: {v} companies
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
