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

const cardCls =
  "rounded-lg border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50";

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
        <p className="text-red-600 dark:text-red-400">{err}</p>
        <WelcomeLoaderModal userName={userName} isReady={pageReady} />
      </div>
    );
  if (!data)
    return (
      <div className="relative">
        <p className="text-gray-500 dark:text-zinc-500">Loading…</p>
        <WelcomeLoaderModal userName={userName} isReady={pageReady} />
      </div>
    );

  return (
    <div className="relative space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Global overview</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">Internal platform metrics.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={cardCls}>
          <p className="text-xs font-medium uppercase text-gray-500 dark:text-zinc-500">Companies</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{data.total_companies}</p>
          <p className="text-xs text-gray-500 dark:text-zinc-500">{data.active_companies} active</p>
        </div>
        <div className={cardCls}>
          <p className="text-xs font-medium uppercase text-gray-500 dark:text-zinc-500">Users</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{data.total_users}</p>
        </div>
        <div className={cardCls}>
          <p className="text-xs font-medium uppercase text-gray-500 dark:text-zinc-500">Feature adoption</p>
          <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-zinc-400">
            {sortFeatureUsageKeys(Object.keys(data.feature_usage)).map((k) => (
              <li key={k}>
                <span className="font-medium text-gray-800 dark:text-zinc-200">{systemAdminFeatureLabel(k)}</span>
                <span className="text-gray-500 dark:text-zinc-500">: </span>
                <span>{data.feature_usage[k]} companies</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <WelcomeLoaderModal userName={userName} isReady={pageReady} />
    </div>
  );
}
