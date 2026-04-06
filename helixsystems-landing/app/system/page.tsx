"use client";

import { WelcomeLoaderModal } from "@/components/ui/WelcomeLoaderModal";
import { apiFetch } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";
import { sortFeatureUsageKeys, systemAdminFeatureLabel } from "@/lib/system-admin-features";
import { useEffect, useMemo, useState } from "react";

function welcomeFromSession(email: string | null | undefined, fullName: string | null | undefined): string {
  if (fullName?.trim()) return fullName.trim();
  if (email) return email.split("@")[0] ?? email;
  return "there";
}

type Overview = {
  total_companies: number;
  active_companies: number;
  total_users: number;
  feature_usage: Record<string, number>;
};

export default function SystemOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pageReady, setPageReady] = useState(false);

  const userName = useMemo(() => {
    const s = readSession();
    return welcomeFromSession(s?.email, s?.full_name);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const o = await apiFetch<Overview>("/api/system/overview");
        setData(o);
      } catch {
        setErr("Failed to load overview.");
      } finally {
        setPageReady(true);
      }
    })();
  }, []);

  if (err)
    return (
      <div className="relative">
        <p className="text-red-400">{err}</p>
        <WelcomeLoaderModal userName={userName} isReady={pageReady} />
      </div>
    );
  if (!data)
    return (
      <div className="relative">
        <p className="text-zinc-500">Loading…</p>
        <WelcomeLoaderModal userName={userName} isReady={pageReady} />
      </div>
    );

  return (
    <div className="relative space-y-6">
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
            {sortFeatureUsageKeys(Object.keys(data.feature_usage)).map((k) => (
              <li key={k}>
                <span className="font-medium text-zinc-200">{systemAdminFeatureLabel(k)}</span>
                <span className="text-zinc-400">: </span>
                <span className="text-zinc-400">{data.feature_usage[k]} companies</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <WelcomeLoaderModal userName={userName} isReady={pageReady} />
    </div>
  );
}
