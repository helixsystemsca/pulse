"use client";

import { LayoutDashboard } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { DASHBOARD_SCOPE_LABEL } from "@/config/platform/dashboard-scope";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import {
  accessibleDashboardsForSession,
  readPersonalDashboardHomepageOverride,
  writePersonalDashboardHomepageOverride,
} from "@/lib/dashboards/homepage";

export function DashboardHomepagePicker({ onToast }: { onToast?: (msg: string) => void }) {
  const { session } = usePulseAuth();
  const [selectedId, setSelectedId] = useState<string>("");

  const options = useMemo(
    () => (session ? accessibleDashboardsForSession(session) : []),
    [session],
  );

  useEffect(() => {
    if (!session?.sub) return;
    const override = readPersonalDashboardHomepageOverride(session.sub);
    setSelectedId(override ?? "");
  }, [session?.sub]);

  const onChange = useCallback(
    (dashboardId: string) => {
      if (!session?.sub) return;
      setSelectedId(dashboardId);
      writePersonalDashboardHomepageOverride(session.sub, dashboardId || null);
      onToast?.(dashboardId ? "Homepage updated." : "Using role and department defaults.");
    },
    [onToast, session?.sub],
  );

  if (!session || options.length === 0) return null;

  return (
    <Card padding="lg" variant="secondary" className="transition-[box-shadow] duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-ds-foreground">Dashboard homepage</p>
          <p className="mt-1 text-xs text-ds-muted">
            Choose where you land after sign-in. Leave as default to follow your role and department.
          </p>
        </div>
        <span className="rounded-full bg-ds-secondary/80 p-2 text-ds-muted">
          <LayoutDashboard className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <label className="mt-4 block">
        <span className="sr-only">Dashboard homepage</span>
        <select
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
        >
          <option value="">Default (role &amp; department)</option>
          {options.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label} · {DASHBOARD_SCOPE_LABEL[d.scope]}
            </option>
          ))}
        </select>
      </label>
    </Card>
  );
}
