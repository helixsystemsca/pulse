"use client";

/**
 * Full compliance UI: KPI cards, category tabs, filters, paginated table, row actions,
 * CSV export. System admins pick a `company_id`; tenant users use the JWT company.
 */
import {
  AlertCircle,
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
import { complianceManagerFlagAllowed, humanizeRole } from "@/lib/pulse-roles";
import { useModuleSettings } from "@/providers/ModuleSettingsProvider";
import { ModuleSettingsGear } from "@/components/module-settings/ModuleSettingsGear";
import { Card } from "@/components/pulse/Card";
import { DataTableCard, dataTableBodyRow, dataTableHeadRowClass } from "@/components/ui/DataTable";
import { dsInputClass, dsLabelClass, dsSelectClass } from "@/components/ui/ds-form-classes";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";
import { HarnessInspectionForm } from "@/components/compliance/HarnessInspectionForm";

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
  return humanizeRole(role);
}

function formatWhen(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

function statusVariant(s: ComplianceRecordRow["effective_status"]): StatusBadgeVariant {
  switch (s) {
    case "completed":
      return "success";
    case "pending":
      return "neutral";
    case "overdue":
      return "warning";
    case "ignored":
      return "danger";
    default:
      return "neutral";
  }
}

function rateHealthBadge(rate: number): { label: string; variant: StatusBadgeVariant } {
  if (rate >= 90) return { label: "Stable", variant: "info" };
  if (rate >= 70) return { label: "Watch", variant: "warning" };
  return { label: "Critical", variant: "danger" };
}

function missedBorderAccent(sev: string): "danger" | "warning" | "info" {
  if (sev === "critical") return "danger";
  if (sev === "warning") return "warning";
  return "info";
}

export function ComplianceApp() {
  const session = readSession();
  const complianceMod = useModuleSettings("compliance");
  const { settings: complianceSettings, loadForCompany } = complianceMod;
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
    if (isSystemAdmin) {
      if (!effectiveCompanyId) return;
      void loadForCompany(effectiveCompanyId);
      return;
    }
    if (!sessionCompanyId) return;
    void loadForCompany(sessionCompanyId);
  }, [isSystemAdmin, effectiveCompanyId, loadForCompany, sessionCompanyId]);

  const canFlagCompliance =
    !complianceSettings.requireManagerForEscalation || complianceManagerFlagAllowed(session);

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
        actions={<ModuleSettingsGear moduleId="compliance" label="Compliance organization settings" />}
      />

      {isSystemAdmin ? (
        <Card variant="secondary" padding="md" className="mt-6">
          <label className={`block ${dsLabelClass}`}>Company</label>
          <select
            className={`${dsSelectClass} mt-1.5 max-w-md md:w-auto`}
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
          <p className="mt-2 text-xs text-ds-muted">
            System administrators must choose a tenant to load compliance analytics.
          </p>
        </Card>
      ) : null}

      {actionError ? (
        <div className="ds-notification ds-notification-critical mt-4 flex gap-2 px-3 py-2 text-sm text-ds-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ds-danger" aria-hidden />
          <p>{actionError}</p>
        </div>
      ) : null}

      {!dataEnabled ? null : summaryHook.error ? (
        <p className="mt-6 text-sm text-ds-danger">{summaryHook.error}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            borderAccent="info"
            label="Compliance rate"
            value={summaryHook.loading ? "—" : `${summaryHook.data?.compliance_rate ?? 0}%`}
            badge={
              rateBadge ? (
                <StatusBadge variant={rateBadge.variant} className="text-[11px]">
                  {rateBadge.label}
                </StatusBadge>
              ) : null
            }
            hint={
              !summaryHook.loading && summaryHook.data ? (
                <span
                  className={
                    summaryHook.data.compliance_rate_trend_pct >= 0 ? "font-semibold text-ds-success" : "font-semibold text-ds-danger"
                  }
                >
                  {summaryHook.data.compliance_rate_trend_pct >= 0 ? "↗" : "↘"}{" "}
                  {Math.abs(summaryHook.data.compliance_rate_trend_pct)} pts vs prior period
                </span>
              ) : null
            }
          />

          <MetricCard
            borderAccent={missedBorderAccent(summaryHook.data?.missed_severity ?? "stable")}
            label="Missed acknowledgments"
            value={summaryHook.loading ? "—" : summaryHook.data?.missed_count ?? 0}
            hint={
              summaryHook.data && summaryHook.data.missed_severity !== "stable"
                ? complianceSettings.strictReviewDeadlines
                  ? "Urgent: overdue reviews are treated as high priority—investigate and close the loop promptly."
                  : "Action required"
                : "Within tolerance"
            }
            badge={
              <AlertTriangle className="h-4 w-4 text-ds-danger" aria-hidden />
            }
          />

          <MetricCard
            borderAccent="warning"
            label="High-risk tool usage"
            value={summaryHook.loading ? "—" : summaryHook.data?.high_risk_count ?? 0}
            hint="Monitored tool violations"
            badge={<Wrench className="h-4 w-4 text-ds-warning" aria-hidden />}
          />

          <MetricCard
            borderAccent="neutral"
            label="Active monitors"
            value={summaryHook.loading ? "—" : summaryHook.data?.active_monitors ?? 0}
            hint="Tools with compliance rules"
          />
        </div>
      )}

      <div className="mt-6 border-b border-ds-border">
        <div className="flex flex-wrap gap-1">
          {TAB_CATS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-ds-secondary text-ds-foreground ring-1 ring-ds-border ring-b-0"
                  : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!dataEnabled ? (
        <p className="mt-8 text-sm text-ds-muted">
          {isSystemAdmin ? "Select a company to view compliance data." : "Sign in as a manager to view compliance."}
        </p>
      ) : (
        <>
          {tab === "inspections" ? (
            <div className="mt-4">
              <HarnessInspectionForm
                onSubmit={(payload) => {
                  // Temporary client-side integration point. Backend saving will plug in here.
                  // eslint-disable-next-line no-console
                  console.log("Harness inspection submit", payload);
                  window.alert("Inspection captured (client-side). Ready to wire into Work Items.");
                }}
              />
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <select className={dsSelectClass} value={toolFilter} onChange={(e) => setToolFilter(e.target.value)}>
                <option value="">All tools</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <div className="relative min-w-[12rem]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
                <input
                  type="search"
                  placeholder="Search user…"
                  value={userQ}
                  onChange={(e) => setUserQ(e.target.value)}
                  className={`${dsInputClass} py-2 pl-9 pr-3`}
                />
              </div>
              <select className={dsSelectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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
                className={dsInputClass}
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={dsInputClass}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSort("date");
                  setDir((d) => (d === "desc" ? "asc" : "desc"));
                }}
                className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-xs")}
              >
                Sort date {sort === "date" ? (dir === "desc" ? "↓" : "↑") : ""}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSort("status");
                  setDir((d) => (d === "desc" ? "asc" : "desc"));
                }}
                className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-xs")}
              >
                Sort status {sort === "status" ? (dir === "desc" ? "↓" : "↑") : ""}
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className={cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex items-center gap-1.5 px-3 py-2 text-xs")}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Export CSV
              </button>
            </div>
          </div>

          <DataTableCard className="mt-4">
            {listHook.loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-ds-muted">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Loading records…
              </div>
            ) : listHook.error ? (
              <p className="p-6 text-sm text-ds-danger">{listHook.error}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className={dataTableHeadRowClass}>
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
                      const repeatEmphasis =
                        complianceSettings.showRepeatOffenderHighlight && row.repeat_offender;
                      const overdueStrict =
                        complianceSettings.strictReviewDeadlines && row.effective_status === "overdue";
                      return (
                        <tr
                          key={row.id}
                          className={dataTableBodyRow(
                            `${repeatEmphasis ? "bg-[color-mix(in_srgb,var(--ds-danger)_10%,var(--ds-surface-secondary))]" : ""} ${overdueStrict ? "ring-1 ring-inset ring-ds-warning/50" : ""}`,
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-secondary text-xs font-bold text-ds-foreground ring-1 ring-ds-border">
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
                                  <span className="font-semibold text-ds-foreground">{row.user_name ?? "—"}</span>
                                  {complianceSettings.showRepeatOffenderHighlight && row.repeat_offender ? (
                                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-ds-danger">
                                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                                      Repeat offender
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-ds-muted">{roleLabel(row.user_role)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
                              <div className="min-w-0">
                                <p className="font-medium text-ds-foreground">{row.tool_name ?? "—"}</p>
                                <p className="truncate text-xs text-ds-muted">
                                  {row.sop_label ?? row.sop_id ?? "SOP"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-ds-foreground">
                            <p className="font-medium">{when.date}</p>
                            <p className="text-xs text-ds-muted">{when.time}</p>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge variant={statusVariant(row.effective_status)} className="capitalize">
                              {row.effective_status}
                            </StatusBadge>
                            {row.flagged ? (
                              <span className="ml-2 text-xs font-semibold text-ds-warning">Flagged</span>
                            ) : null}
                            {complianceSettings.strictReviewDeadlines && row.effective_status === "overdue" ? (
                              <span className="mt-1 block text-xs font-bold text-ds-warning">
                                Review overdue — address before it escalates.
                              </span>
                            ) : null}
                          </td>
                          <td className="relative px-4 py-3 text-right">
                            <button
                              type="button"
                              className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex h-8 w-8 items-center justify-center p-0")}
                              aria-label="Row actions"
                              onClick={() => setMenuFor((m) => (m === row.id ? null : row.id))}
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden />
                            </button>
                            {menuFor === row.id ? (
                              <div className="absolute right-4 z-30 mt-1 w-52 rounded-lg border border-ds-border bg-ds-elevated py-1 text-left shadow-lg">
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-ds-foreground hover:bg-ds-secondary"
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
                                  className="block w-full px-3 py-2 text-left text-sm text-ds-foreground hover:bg-ds-secondary"
                                  onClick={() => onReview(row.id)}
                                >
                                  Mark as reviewed
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-ds-foreground hover:bg-ds-secondary"
                                  onClick={() => onResend(row.id)}
                                >
                                  Resend acknowledgment
                                </button>
                                <button
                                  type="button"
                                  disabled={!canFlagCompliance}
                                  title={
                                    !canFlagCompliance
                                      ? "Only managers and company administrators may flag records in your organization."
                                      : undefined
                                  }
                                  className="block w-full px-3 py-2 text-left text-sm text-ds-foreground hover:bg-ds-secondary disabled:cursor-not-allowed disabled:opacity-45"
                                  onClick={() => {
                                    if (!canFlagCompliance) return;
                                    void onFlag(row.id, !row.flagged);
                                  }}
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
            <div className="flex flex-col gap-2 border-t border-ds-border px-4 py-3 text-sm text-ds-muted sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {start} to {end} of {total} results
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-2 py-1 text-xs disabled:opacity-40")}
                >
                  Prev
                </button>
                <span className="text-xs font-semibold text-ds-foreground">
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-2 py-1 text-xs disabled:opacity-40")}
                >
                  Next
                </button>
              </div>
            </div>
          </DataTableCard>
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
