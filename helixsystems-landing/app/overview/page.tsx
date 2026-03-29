"use client";

import { LayoutDashboard, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, isApiMode } from "@/lib/api";
import { pulseRoutes } from "@/lib/pulse-app";
import { clearSession, readSession } from "@/lib/pulse-session";

type DashboardPayload = {
  active_workers: number;
  open_work_requests: number;
  low_stock_items: number;
  shifts_today: number;
  alerts: string[];
};

function roleLabel(role: string | undefined): string {
  switch (role) {
    case "company_admin":
      return "Admin";
    case "manager":
      return "Supervisor";
    case "worker":
      return "Worker";
    case "system_admin":
      return "System admin";
    default:
      return role ?? "User";
  }
}

export default function OverviewPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [systemAdmin, setSystemAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace(pulseRoutes.login);
      return;
    }
    setEmail(s.email);
    setRole(s.role ?? null);
    setSystemAdmin(Boolean(s.is_system_admin || s.role === "system_admin"));
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready || !isApiMode()) {
      setDashboard(null);
      setDashboardError(null);
      return;
    }
    let cancelled = false;
    setDashboardLoading(true);
    setDashboardError(null);
    (async () => {
      try {
        const data = await apiFetch<DashboardPayload>("/api/v1/pulse/dashboard");
        if (!cancelled) setDashboard(data);
      } catch (err) {
        const e = err as Error & { status?: number; body?: unknown };
        if (cancelled) return;
        if (e.status === 403) {
          setDashboardError(
            "Pulse data is available for company accounts only. Sign in as a tenant user (not the global system admin).",
          );
        } else {
          setDashboardError("Could not load dashboard. Check that the API is running and you are signed in.");
        }
        setDashboard(null);
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const signOut = useCallback(() => {
    clearSession();
    router.push(pulseRoutes.login);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pulse-bg">
        <p className="text-sm text-pulse-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pulse-bg px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-pulse-border bg-white p-8 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-pulse-accent">
            <LayoutDashboard className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h1 className="font-headline text-2xl font-bold text-pulse-navy">Operational overview</h1>
            <p className="mt-1 text-sm text-pulse-muted">
              Signed in as{" "}
              <span className="font-medium text-pulse-navy">{email}</span>
              {role ? (
                <span className="text-pulse-muted">
                  {" "}
                  · <span className="font-medium text-pulse-navy">{roleLabel(role)}</span>
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {isApiMode() ? (
          <div className="mt-6 space-y-4">
            {dashboardLoading ? (
              <p className="text-sm text-pulse-muted">Loading live metrics…</p>
            ) : null}
            {dashboardError ? (
              <p
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                role="status"
              >
                {dashboardError}
              </p>
            ) : null}
            {dashboard && !dashboardError ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-pulse-border bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">Active workers</p>
                  <p className="mt-1 text-2xl font-bold text-pulse-navy">{dashboard.active_workers}</p>
                </div>
                <div className="rounded-xl border border-pulse-border bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">Open work requests</p>
                  <p className="mt-1 text-2xl font-bold text-pulse-navy">{dashboard.open_work_requests}</p>
                </div>
                <div className="rounded-xl border border-pulse-border bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">Low-stock items</p>
                  <p className="mt-1 text-2xl font-bold text-pulse-navy">{dashboard.low_stock_items}</p>
                </div>
                <div className="rounded-xl border border-pulse-border bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">Shifts today</p>
                  <p className="mt-1 text-2xl font-bold text-pulse-navy">{dashboard.shifts_today}</p>
                </div>
              </div>
            ) : null}
            {dashboard && dashboard.alerts.length > 0 ? (
              <div className="rounded-xl border border-red-100 bg-red-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Alerts</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-900">
                  {dashboard.alerts.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-6 text-sm leading-relaxed text-pulse-muted">
            Demo mode: you are using mock sign-in. Set <code className="text-pulse-navy">NEXT_PUBLIC_API_URL</code> and
            clear <code className="text-pulse-navy">NEXT_PUBLIC_USE_MOCK_AUTH</code> to load live dashboard data from
            the API.
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {systemAdmin && isApiMode() ? (
            <Link
              href="/system"
              className="inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-slate-800"
            >
              System admin
            </Link>
          ) : null}
          <Link
            href="/pulse"
            className="inline-flex items-center justify-center rounded-xl border border-pulse-border bg-white px-4 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
          >
            Product overview
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
