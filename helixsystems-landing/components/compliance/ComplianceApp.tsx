"use client";

/**
 * Full compliance UI: KPI cards, category tabs, filters, paginated table, row actions,
 * CSV export. System admins pick a `company_id`; tenant users use the JWT company.
 */
import {
  AlertTriangle,
  Download,
  Loader2,
  MoreVertical,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useComplianceList, useComplianceSummary } from "@/hooks/useCompliance";
import { apiFetch } from "@/lib/api";
import {
  postComplianceFlag,
  postComplianceResend,
  postComplianceReview,
  type ComplianceRecordRow,
} from "@/lib/complianceService";
import { readSession } from "@/lib/pulse-session";
import { PageHeader } from "@/components/ui/PageHeader";

type AssetOption = { id: string; name: string };
type CompanyOption = { id: string; name: string };

const TAB_CATS = [
  { id: "procedures", label: "Procedures" },
  { id: "inspections", label: "Inspections" },
  { id: "training", label: "Training" },
  { id: "competency", label: "Competency" },
] as const;

function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatWhen(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

function statusBadgeClass(s: ComplianceRecordRow["effective_status"]): string {
  switch (s) {
    case "completed":
      return "bg-sky-50 text-[#1e4a8a] ring-1 ring-sky-200/70";
    case "pending":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";
    case "overdue":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
    case "ignored":
      return "bg-rose-50 text-rose-800 ring-1 ring-rose-200/70";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function rateHealthBadge(rate: number): { label: string; className: string } {
  if (rate >= 90) return { label: "Stable", className: "bg-sky-50 text-[#1e4a8a] ring-1 ring-sky-200/60" };
  if (rate >= 70) return { label: "Watch", className: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/60" };
  return { label: "Critical", className: "bg-rose-50 text-rose-800 ring-1 ring-rose-200/60" };
}

function missedAccent(sev: string): string {
  if (sev === "critical") return "border-l-rose-500";
  if (sev === "warning") return "border-l-amber-500";
  return "border-l-[#2563eb]";
}

export function ComplianceApp() {
  const session = readSession();
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const sessionCompanyId = session?.company_id ?? null;

  const [companyPick, setCompanyPick] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);

  const effectiveCompanyId = isSystemAdmin ? companyPick : sessionCompanyId;
  const dataEnabled = Boolean(effectiveCompanyId);

  const [tab, setTab] = useState<string>("procedures");
  const [toolFilter, setToolFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [userQ, setUserQ] = useState("");
  const [userQDebounced, setUserQDebounced] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<"date" | "status">("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 12;
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setUserQDebounced(userQ.trim()), 300);
    return () => window.clearTimeout(t);
  }, [userQ]);

  useEffect(() => {
    if (!isSystemAdmin || !session?.access_token) return;
    void (async () => {
      try {
        const rows = await apiFetch<CompanyOption[]>(`/api/system/companies?include_inactive=false&q=`);
        setCompanies(rows.map((r) => ({ id: r.id, name: r.name })));
      } catch {
        setCompanies([]);
      }
    })();
  }, [isSystemAdmin, session?.access_token]);

  useEffect(() => {
    if (!dataEnabled || isSystemAdmin) {
      setAssets([]);
      return;
    }
    void (async () => {
      try {
        const list = await apiFetch<AssetOption[]>(`/api/v1/pulse/assets`);
        setAssets(list.map((a) => ({ id: a.id, name: a.name })));
      } catch {
        setAssets([]);
      }
    })();
  }, [dataEnabled, isSystemAdmin]);

  const summaryHook = useComplianceSummary(effectiveCompanyId, dataEnabled);
  const listParams = useMemo(
    () => ({
      companyId: effectiveCompanyId ?? undefined,
      category: tab,
      toolId: toolFilter || undefined,
      status: statusFilter || undefined,
      q: userQDebounced || undefined,
      dateFrom: dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined,
      dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
      sort,
      dir,
      limit: pageSize,
      offset: page * pageSize,
    }),
    [
      effectiveCompanyId,
      tab,
      toolFilter,
      statusFilter,
      userQDebounced,
      dateFrom,
      dateTo,
      sort,
      dir,
      page,
      pageSize,
    ],
  );
  const listHook = useComplianceList(dataEnabled, listParams);

  useEffect(() => {
    setPage(0);
  }, [tab, toolFilter, statusFilter, userQDebounced, dateFrom, dateTo, sort, dir]);

  const closeMenu = useCallback(() => setMenuFor(null), []);

  const onReview = async (id: string) => {
    setActionError(null);
    closeMenu();
    try {
      await postComplianceReview(id, effectiveCompanyId ?? undefined);
      void summaryHook.reload();
      void listHook.reload();
    } catch {
      setActionError("Could not mark as reviewed.");
    }
  };

  const onResend = async (id: string) => {
    setActionError(null);
    closeMenu();
    try {
      await postComplianceResend(id, effectiveCompanyId ?? undefined);
      void summaryHook.reload();
      void listHook.reload();
    } catch {
      setActionError("Could not resend acknowledgment.");
    }
  };

  const onFlag = async (id: string, flagged: boolean) => {
    setActionError(null);
    closeMenu();
    try {
      await postComplianceFlag(id, flagged, effectiveCompanyId ?? undefined);
      void listHook.reload();
    } catch {
      setActionError("Could not update flag.");
    }
  };

  const exportCsv = () => {
    const rows = listHook.data?.items ?? [];
    const header = [
      "user",
      "role",
      "tool",
      "sop",
      "required_at",
      "status",
      "repeat_offender",
      "flagged",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          JSON.stringify(r.user_name ?? ""),
          JSON.stringify(roleLabel(r.user_role)),
          JSON.stringify(r.tool_name ?? ""),
          JSON.stringify(r.sop_label ?? r.sop_id ?? ""),
          JSON.stringify(r.required_at),
          r.effective_status,
          r.repeat_offender,
          r.flagged,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compliance-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = listHook.data?.total ?? 0;
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rateBadge = summaryHook.data ? rateHealthBadge(summaryHook.data.compliance_rate) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance Analytics"
        description="SOP acknowledgments, risk signals, and repeat patterns."
        icon={ShieldCheck}
      />

      {isSystemAdmin ? (
        <div className="mt-6 rounded-md border border-pulse-border bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-pulse-muted">Company</label>
          <select
            className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 md:w-auto"
            value={companyPick ?? ""}
            onChange={(e) => setCompanyPick(e.target.value || null)}
          >
            <option value="">Select company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-pulse-muted">
            System administrators must choose a tenant to load compliance analytics.
          </p>
        </div>
      ) : null}

      {actionError ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {actionError}
        </p>
      ) : null}

      {!dataEnabled ? null : summaryHook.error ? (
        <p className="mt-6 text-sm text-rose-600">{summaryHook.error}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-pulse-border bg-white p-4 shadow-sm ring-1 ring-slate-100/80 border-l-4 border-l-[#2563eb]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">Compliance rate</span>
              {rateBadge ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${rateBadge.className}`}
                >
                  {rateBadge.label}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-pulse-navy">
              {summaryHook.loading ? "—" : `${summaryHook.data?.compliance_rate ?? 0}%`}
            </p>
            {!summaryHook.loading && summaryHook.data ? (
              <p
                className={`mt-1 text-sm font-semibold ${summaryHook.data.compliance_rate_trend_pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}
              >
                {summaryHook.data.compliance_rate_trend_pct >= 0 ? "↗" : "↘"}{" "}
                {Math.abs(summaryHook.data.compliance_rate_trend_pct)} pts vs prior period
              </p>
            ) : null}
          </div>

          <div
            className={`rounded-md border border-pulse-border bg-white p-4 shadow-sm ring-1 ring-slate-100/80 border-l-4 ${missedAccent(summaryHook.data?.missed_severity ?? "stable")}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
                Missed acknowledgments
              </span>
              <AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-pulse-navy">
              {summaryHook.loading ? "—" : summaryHook.data?.missed_count ?? 0}
            </p>
            <p className="mt-1 text-sm text-pulse-muted">
              {summaryHook.data && summaryHook.data.missed_severity !== "stable"
                ? "Action required"
                : "Within tolerance"}
            </p>
          </div>

          <div className="rounded-md border border-pulse-border bg-white p-4 shadow-sm ring-1 ring-slate-100/80 border-l-4 border-l-amber-600/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
                High-risk tool usage
              </span>
              <Wrench className="h-4 w-4 text-amber-700" aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-pulse-navy">
              {summaryHook.loading ? "—" : summaryHook.data?.high_risk_count ?? 0}
            </p>
            <p className="mt-1 text-sm text-pulse-muted">Monitored tool violations</p>
          </div>

          <div className="rounded-md border border-pulse-border bg-white p-4 shadow-sm ring-1 ring-slate-100/80 border-l-4 border-l-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">Active monitors</span>
            <p className="mt-3 text-3xl font-bold tabular-nums text-pulse-navy">
              {summaryHook.loading ? "—" : summaryHook.data?.active_monitors ?? 0}
            </p>
            <p className="mt-1 text-sm text-pulse-muted">Tools with compliance rules</p>
          </div>
        </div>
      )}

      <div className="mt-6 border-b border-pulse-border">
        <div className="flex flex-wrap gap-1">
          {TAB_CATS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-sky-50/95 text-[#1e4a8a] ring-1 ring-sky-200/60 ring-b-0"
                  : "text-pulse-muted hover:bg-slate-50 hover:text-pulse-navy"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!dataEnabled ? (
        <p className="mt-8 text-sm text-pulse-muted">
          {isSystemAdmin ? "Select a company to view compliance data." : "Sign in as a manager to view compliance."}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <select
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25"
                value={toolFilter}
                onChange={(e) => setToolFilter(e.target.value)}
              >
                <option value="">All tools</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <div className="relative min-w-[12rem]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted" />
                <input
                  type="search"
                  placeholder="Search user…"
                  value={userQ}
                  onChange={(e) => setUserQ(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-sm text-pulse-navy placeholder:text-slate-400 outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25"
                />
              </div>
              <select
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="ignored">Ignored</option>
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSort("date");
                  setDir((d) => (d === "desc" ? "asc" : "desc"));
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-pulse-navy shadow-sm hover:bg-slate-50"
              >
                Sort date {sort === "date" ? (dir === "desc" ? "↓" : "↑") : ""}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSort("status");
                  setDir((d) => (d === "desc" ? "asc" : "desc"));
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-pulse-navy shadow-sm hover:bg-slate-50"
              >
                Sort status {sort === "status" ? (dir === "desc" ? "↓" : "↑") : ""}
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-[#1e4a8a] ring-1 ring-sky-200/70 hover:bg-sky-100/80"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Export CSV
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-pulse-border bg-white shadow-sm ring-1 ring-slate-100/80">
            {listHook.loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-pulse-muted">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Loading records…
              </div>
            ) : listHook.error ? (
              <p className="p-6 text-sm text-rose-600">{listHook.error}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-pulse-border bg-slate-50/80 text-xs font-bold uppercase tracking-wide text-pulse-muted">
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Tool / SOP</th>
                      <th className="px-4 py-3">Date / time</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(listHook.data?.items ?? []).map((row) => {
                      const when = formatWhen(row.required_at);
                      return (
                        <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-pulse-navy ring-1 ring-slate-200/60">
                                {(row.user_name ?? "?")
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((p) => p[0])
                                  .join("")
                                  .toUpperCase() || "?"}
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold text-pulse-navy">{row.user_name ?? "—"}</span>
                                  {row.repeat_offender ? (
                                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-600">
                                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                                      Repeat offender
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-pulse-muted">{roleLabel(row.user_role)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                              <div className="min-w-0">
                                <p className="font-medium text-pulse-navy">{row.tool_name ?? "—"}</p>
                                <p className="truncate text-xs text-pulse-muted">
                                  {row.sop_label ?? row.sop_id ?? "SOP"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-pulse-navy">
                            <p className="font-medium">{when.date}</p>
                            <p className="text-xs text-pulse-muted">{when.time}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${statusBadgeClass(row.effective_status)}`}
                            >
                              {row.effective_status}
                            </span>
                            {row.flagged ? (
                              <span className="ml-2 text-xs font-semibold text-amber-700">Flagged</span>
                            ) : null}
                          </td>
                          <td className="relative px-4 py-3 text-right">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-pulse-navy hover:bg-slate-50"
                              aria-label="Row actions"
                              onClick={() => setMenuFor((m) => (m === row.id ? null : row.id))}
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden />
                            </button>
                            {menuFor === row.id ? (
                              <div className="absolute right-4 z-30 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg">
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50"
                                  onClick={() => {
                                    closeMenu();
                                    window.alert(
                                      `${row.user_name ?? "User"} · ${row.tool_name ?? "Tool"}\n` +
                                        `SOP: ${row.sop_label ?? row.sop_id ?? "—"}\n` +
                                        `Status: ${row.effective_status}\n` +
                                        `Required: ${new Date(row.required_at).toLocaleString()}`,
                                    );
                                  }}
                                >
                                  View details
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50"
                                  onClick={() => onReview(row.id)}
                                >
                                  Mark as reviewed
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50"
                                  onClick={() => onResend(row.id)}
                                >
                                  Resend acknowledgment
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50"
                                  onClick={() => onFlag(row.id, !row.flagged)}
                                >
                                  {row.flagged ? "Unflag user" : "Flag user"}
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-col gap-2 border-t border-pulse-border px-4 py-3 text-sm text-pulse-muted sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {start} to {end} of {total} results
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-pulse-navy disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-xs font-semibold text-pulse-navy">
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-pulse-navy disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {menuFor ? (
        <button
          type="button"
          className="fixed inset-0 z-20 cursor-default bg-transparent"
          aria-label="Close menu"
          onClick={closeMenu}
        />
      ) : null}
    </div>
  );
}
