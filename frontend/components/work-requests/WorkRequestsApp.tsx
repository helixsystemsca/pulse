"use client";

/**
 * Work requests / issue tracking: filters, table, detail drawer, create drawer, settings.
 * Matches Compliance/Schedule shell styling (Pulse industrial UI).
 */
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronsRight,
  ClipboardList,
  Loader2,
  Minus,
  MoreVertical,
  Pause,
  Search,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { fetchEquipmentList, fetchEquipmentParts } from "@/lib/equipmentService";
import { emitOnboardingMaybeUpdated } from "@/lib/onboarding-events";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { ModuleSettingsGear } from "@/components/module-settings/ModuleSettingsGear";
import { PageHeader } from "@/components/ui/PageHeader";
import { managerOrAbove } from "@/lib/pulse-roles";
import { readSession } from "@/lib/pulse-session";
import type {
  WorkRequestDetail,
  WorkRequestRow,
  WrSettings,
} from "@/lib/workRequestsService";
import {
  createWorkRequest,
  fetchWorkRequestDetail,
  fetchWorkRequestList,
  fetchWorkRequestSettings,
  patchWorkRequest,
  patchWorkRequestSettings,
  postWorkRequestComment,
  postWorkRequestStatus,
} from "@/lib/workRequestsService";
import { useModuleSettings, useModuleSettingsOptional } from "@/providers/ModuleSettingsProvider";

type CompanyOption = { id: string; name: string };
type ZoneOpt = { id: string; name: string };
type AssetOpt = { id: string; name: string; tag_id?: string | null; zone_id?: string | null };
type EquipmentOpt = { id: string; name: string };
type WrPartOpt = { id: string; name: string };
type WorkerOpt = { id: string; email: string; full_name: string | null; role: string };

const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:placeholder:text-gray-500";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

function initials(name: string | null | undefined, email: string | null | undefined): string {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    return p[0].slice(0, 2).toUpperCase();
  }
  const local = email?.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "?";
}

function formatDue(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusBadgeClass(display: string): string {
  switch (display) {
    case "overdue":
      return "bg-[#fdebeb] text-[#c53030] ring-1 ring-red-200/80 dark:bg-red-600 dark:text-white dark:ring-red-500/45";
    case "in_progress":
      return "bg-[#ebf8ff] text-[#3182ce] ring-1 ring-blue-200/80 dark:bg-blue-600 dark:text-white dark:ring-blue-500/40";
    case "hold":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-700 dark:text-white dark:ring-amber-500/40";
    case "completed":
      return "bg-[#e6fffa] text-[#38a169] ring-1 ring-emerald-200/70 dark:bg-emerald-600 dark:text-white dark:ring-emerald-500/40";
    case "cancelled":
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-600 dark:text-white dark:ring-slate-500/40";
    default:
      return "bg-sky-50/90 text-[#2B4C7E] ring-1 ring-sky-200/70 dark:bg-sky-600 dark:text-white dark:ring-sky-400/40";
  }
}

function priorityBadgeClass(p: string): string {
  switch (p) {
    case "critical":
      return "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80 dark:bg-red-600 dark:text-white dark:ring-red-500/45";
    case "high":
      return "bg-orange-50 text-orange-800 ring-1 ring-orange-200/70 dark:bg-orange-600 dark:text-white dark:ring-orange-400/40";
    case "medium":
      return "bg-sky-50 text-[#3182ce] ring-1 ring-sky-200/70 dark:bg-sky-600 dark:text-white dark:ring-sky-400/40";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200/75 dark:bg-slate-600 dark:text-white dark:ring-slate-500/40";
  }
}

function StatusIcon({ display }: { display: string }) {
  if (display === "overdue") return <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  if (display === "completed") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  if (display === "in_progress") return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />;
  if (display === "hold") return <Pause className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" aria-hidden />;
}

function PriorityIcon({ p }: { p: string }) {
  if (p === "critical") return <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  if (p === "high") return <ChevronsRight className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  if (p === "medium") return <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  return <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />;
}

const SETTINGS_TABS = ["Statuses", "Priorities & SLA", "Assignment", "Notifications"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

export type WorkRequestsAppProps = {
  /** When true, list is driven by hub category + status chips from the maintenance hub URL. */
  hubMode?: boolean;
  initialHubCategory?: string;
  initialStatusFilter?: string;
};

export function WorkRequestsApp(props?: WorkRequestsAppProps) {
  const { hubMode = false, initialHubCategory = "", initialStatusFilter = "" } = props ?? {};
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wrMod = useModuleSettings("workRequests");
  const moduleSettingsCtx = useModuleSettingsOptional();
  const session = readSession();
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const sessionCompanyId = session?.company_id ?? null;
  const canManage = managerOrAbove(session);

  const [companyPick, setCompanyPick] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const effectiveCompanyId = isSystemAdmin ? companyPick : sessionCompanyId;
  const dataEnabled = Boolean(effectiveCompanyId) && canManage;

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState(hubMode ? initialStatusFilter : "");
  const [hubCategoryFilter, setHubCategoryFilter] = useState(hubMode ? initialHubCategory : "");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const [zones, setZones] = useState<ZoneOpt[]>([]);
  const [assets, setAssets] = useState<AssetOpt[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOpt[]>([]);
  const [wrPartOptions, setWrPartOptions] = useState<WrPartOpt[]>([]);
  const [workers, setWorkers] = useState<WorkerOpt[]>([]);

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [rows, setRows] = useState<WorkRequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [overdueCritical, setOverdueCritical] = useState(0);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("Statuses");
  const [settingsDraft, setSettingsDraft] = useState<WrSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    tool_id: "",
    equipment_id: "",
    part_id: "",
    zone_id: "",
    category: "",
    priority: "medium",
    assigned_user_id: "",
    due_date: "",
    attachmentsNotes: "",
  });

  const [detailEquipmentDraft, setDetailEquipmentDraft] = useState("");
  const lastCreateQuerySig = useRef<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!moduleSettingsCtx || !isSystemAdmin || !effectiveCompanyId) return;
    void moduleSettingsCtx.loadForCompany(effectiveCompanyId);
  }, [moduleSettingsCtx, isSystemAdmin, effectiveCompanyId]);

  useEffect(() => {
    if (!isSystemAdmin || !session?.access_token) return;
    void (async () => {
      try {
        const r = await apiFetch<CompanyOption[]>(`/api/system/companies?include_inactive=false&q=`);
        setCompanies(r.map((x) => ({ id: x.id, name: x.name })));
      } catch {
        setCompanies([]);
      }
    })();
  }, [isSystemAdmin, session?.access_token]);

  useEffect(() => {
    if (!dataEnabled || !session?.access_token) {
      setZones([]);
      setAssets([]);
      setEquipmentOptions([]);
      setWorkers([]);
      return;
    }
    void (async () => {
      try {
        const [z, a, w, eq] = await Promise.all([
          apiFetch<ZoneOpt[]>(`/api/v1/pulse/zones`),
          apiFetch<AssetOpt[]>(`/api/v1/pulse/assets`),
          apiFetch<WorkerOpt[]>(`/api/v1/pulse/workers`),
          fetchEquipmentList({}).catch(() => []),
        ]);
        setZones(z);
        setAssets(a);
        setEquipmentOptions(eq.map((r) => ({ id: r.id, name: r.name })));
        setWorkers(w);
      } catch {
        setZones([]);
        setAssets([]);
        setEquipmentOptions([]);
        setWorkers([]);
      }
    })();
  }, [dataEnabled, session?.access_token]);

  const wrFromUrl = searchParams.get("wr");

  useEffect(() => {
    if (!dataEnabled || !wrFromUrl?.trim()) return;
    setDetailId(wrFromUrl.trim());
  }, [dataEnabled, wrFromUrl]);

  useEffect(() => {
    if (!hubMode) return;
    setHubCategoryFilter(initialHubCategory ?? "");
    setStatusFilter(initialStatusFilter ?? "");
    setPage(0);
  }, [hubMode, initialHubCategory, initialStatusFilter]);

  useEffect(() => {
    if (!dataEnabled || searchParams.get("create") !== "1") return;
    const sig = searchParams.toString();
    if (lastCreateQuerySig.current === sig) return;
    lastCreateQuerySig.current = sig;
    const eq = searchParams.get("equipment_id") ?? "";
    const pt = searchParams.get("part_id") ?? "";
    const wt = searchParams.get("wr_title");
    setCreateOpen(true);
    setCreateForm((f) => ({
      ...f,
      equipment_id: eq || f.equipment_id,
      part_id: pt || f.part_id,
      title: wt ? decodeURIComponent(wt.replace(/\+/g, " ")) : f.title,
    }));
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("create");
    sp.delete("equipment_id");
    sp.delete("part_id");
    sp.delete("wr_title");
    const nq = sp.toString();
    router.replace(nq ? `${pathname}?${nq}` : pathname, { scroll: false });
  }, [dataEnabled, searchParams, pathname, router]);

  useEffect(() => {
    if (!createOpen || !createForm.equipment_id) {
      setWrPartOptions([]);
      return;
    }
    void (async () => {
      try {
        const parts = await fetchEquipmentParts(createForm.equipment_id);
        const opts = parts.map((p) => ({ id: p.id, name: p.name }));
        setWrPartOptions(opts);
        setCreateForm((f) => {
          if (!f.part_id) return f;
          if (!opts.some((x) => x.id === f.part_id)) return { ...f, part_id: "" };
          return f;
        });
      } catch {
        setWrPartOptions([]);
      }
    })();
  }, [createOpen, createForm.equipment_id]);

  const loadList = useCallback(async () => {
    if (!dataEnabled || !effectiveCompanyId) return;
    setListLoading(true);
    setListError(null);
    try {
      const due_after = dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined;
      const due_before = dateTo ? `${dateTo}T23:59:59.999Z` : undefined;
      const res = await fetchWorkRequestList({
        companyId: isSystemAdmin ? effectiveCompanyId : null,
        q: qDebounced || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        zone_id: zoneFilter || undefined,
        hub_category: hubMode && hubCategoryFilter ? hubCategoryFilter : undefined,
        due_after,
        due_before,
        limit: pageSize,
        offset: page * pageSize,
      });
      setRows(res.items);
      setTotal(res.total);
      setOverdueCritical(res.overdue_critical_count);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  }, [
    dataEnabled,
    effectiveCompanyId,
    isSystemAdmin,
    qDebounced,
    statusFilter,
    priorityFilter,
    zoneFilter,
    dateFrom,
    dateTo,
    page,
    hubMode,
    hubCategoryFilter,
  ]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async () => {
    if (!detailId || !effectiveCompanyId) return;
    setDetailLoading(true);
    try {
      const d = await fetchWorkRequestDetail(isSystemAdmin ? effectiveCompanyId : null, detailId);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [detailId, effectiveCompanyId, isSystemAdmin]);

  useEffect(() => {
    if (detailId) void loadDetail();
    else setDetail(null);
  }, [detailId, loadDetail]);

  useEffect(() => {
    if (detail) {
      setDetailEquipmentDraft(detail.equipment_id ?? "");
    } else {
      setDetailEquipmentDraft("");
    }
  }, [detail]);

  const closeDetail = useCallback(() => {
    setDetailId(null);
    const wr = searchParams.get("wr");
    if (wr) {
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("wr");
      const next = sp.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!settingsOpen || !effectiveCompanyId) return;
    setSettingsLoading(true);
    void (async () => {
      try {
        const r = await fetchWorkRequestSettings(isSystemAdmin ? effectiveCompanyId : null);
        setSettingsDraft(r.settings);
      } catch {
        setSettingsDraft({});
      } finally {
        setSettingsLoading(false);
      }
    })();
  }, [settingsOpen, effectiveCompanyId, isSystemAdmin]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);

  function clearFilters() {
    setQ("");
    setPriorityFilter("");
    setZoneFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
    if (hubMode) {
      setStatusFilter(initialStatusFilter ?? "");
      setHubCategoryFilter(initialHubCategory ?? "");
    } else {
      setStatusFilter("");
      setHubCategoryFilter("");
    }
  }

  function applyCriticalView() {
    setStatusFilter("overdue");
    setPriorityFilter("critical");
    setPage(0);
  }

  async function onCreateSubmit() {
    if (!effectiveCompanyId || !createForm.title.trim()) return;
    setActionBusy(true);
    try {
      let attachments: unknown[] | null = null;
      if (createForm.attachmentsNotes.trim()) {
        attachments = createForm.attachmentsNotes.split("\n").map((line, i) => ({
          name: `Attachment ${i + 1}`,
          note: line.trim(),
        }));
      }
      await createWorkRequest(isSystemAdmin ? effectiveCompanyId : null, {
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
        tool_id: createForm.tool_id || null,
        equipment_id: createForm.equipment_id || null,
        part_id: createForm.part_id || null,
        zone_id: createForm.zone_id || null,
        category: createForm.category.trim() || null,
        priority: createForm.priority,
        assigned_user_id: createForm.assigned_user_id || null,
        due_date: createForm.due_date ? `${createForm.due_date}T12:00:00.000Z` : null,
        attachments,
      });
      setCreateOpen(false);
      setCreateForm({
        title: "",
        description: "",
        tool_id: "",
        equipment_id: "",
        part_id: "",
        zone_id: "",
        category: "",
        priority: "medium",
        assigned_user_id: "",
        due_date: "",
        attachmentsNotes: "",
      });
      await loadList();
      emitOnboardingMaybeUpdated();
    } finally {
      setActionBusy(false);
    }
  }

  async function submitComment() {
    if (!detailId || !commentText.trim() || !effectiveCompanyId) return;
    setActionBusy(true);
    try {
      await postWorkRequestComment(isSystemAdmin ? effectiveCompanyId : null, detailId, commentText.trim());
      setCommentText("");
      await loadDetail();
      await loadList();
    } finally {
      setActionBusy(false);
    }
  }

  async function saveDetailEquipment() {
    if (!detailId || !effectiveCompanyId || !canManage) return;
    setActionBusy(true);
    try {
      await patchWorkRequest(isSystemAdmin ? effectiveCompanyId : null, detailId, {
        equipment_id: detailEquipmentDraft || null,
      });
      await loadDetail();
      await loadList();
    } finally {
      setActionBusy(false);
    }
  }

  async function quickStatus(id: string, status: string) {
    if (!effectiveCompanyId) return;
    setActionBusy(true);
    setListError(null);
    try {
      await postWorkRequestStatus(isSystemAdmin ? effectiveCompanyId : null, id, status);
      setMenuFor(null);
      await loadList();
      if (detailId === id) await loadDetail();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not update status";
      setListError(msg);
    } finally {
      setActionBusy(false);
    }
  }

  const defaultSettings = useMemo(
    () => ({
      statuses: { open: true, in_progress: true, hold: true, completed: true, cancelled: true },
      priority_colors: { low: "#64748b", medium: "#3182ce", high: "#dd6b20", critical: "#c53030" },
      sla_hours: { critical: 24, high: 48, medium: 72, low: 168 },
      assignment_rules: { default_by: "asset" },
      notifications: { new_request: true, assignment: true, overdue: true },
    }),
    [],
  );

  async function saveSettings() {
    if (!effectiveCompanyId || !settingsDraft) return;
    setActionBusy(true);
    try {
      const merged = {
        ...defaultSettings,
        ...settingsDraft,
        statuses: { ...defaultSettings.statuses, ...settingsDraft.statuses },
        priority_colors: { ...defaultSettings.priority_colors, ...settingsDraft.priority_colors },
        sla_hours: { ...defaultSettings.sla_hours, ...settingsDraft.sla_hours },
        assignment_rules: { ...defaultSettings.assignment_rules, ...settingsDraft.assignment_rules },
        notifications: { ...defaultSettings.notifications, ...settingsDraft.notifications },
      };
      await patchWorkRequestSettings(isSystemAdmin ? effectiveCompanyId : null, merged);
      setSettingsOpen(false);
    } finally {
      setActionBusy(false);
    }
  }

  if (!canManage) {
    return (
      <p className="text-sm text-pulse-muted">Work requests are available to managers and administrators.</p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Requests"
        description={
          hubMode
            ? "Triaged requests and work orders for your facility. Use the hub chips above to narrow by category and status ID."
            : "Manage and monitor maintenance tasks across all zones."
        }
        icon={ClipboardList}
        actions={
          <>
            <ModuleSettingsGear moduleId="workRequests" label="Work requests organization settings" />
            <button
              type="button"
              className="app-btn-secondary inline-flex items-center gap-2 px-4 py-2.5"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" aria-hidden />
              Workflow
            </button>
            <button
              type="button"
              className={PRIMARY_BTN}
              onClick={() => setCreateOpen(true)}
              disabled={!dataEnabled}
            >
              + New Work Request
            </button>
          </>
        }
      />

      {isSystemAdmin ? (
        <div className="mt-6 rounded-md border border-pulse-border bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-pulse-muted">Company</label>
          <select
            className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 md:w-auto"
            value={companyPick ?? ""}
            onChange={(e) => {
              setCompanyPick(e.target.value || null);
              setPage(0);
            }}
          >
            <option value="">Select company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!dataEnabled ? (
        <p className="mt-8 text-sm text-pulse-muted">
          {isSystemAdmin ? "Select a company to load work requests." : "Unable to resolve organization."}
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <div className="relative min-w-[14rem]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted" />
                <input
                  type="search"
                  placeholder="Search assets, requests, locations…"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(0);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-sm text-pulse-navy placeholder:text-slate-400 outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>
              <select
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
                value={statusFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setStatusFilter(v);
                  setPage(0);
                  if (hubMode) {
                    const sp = new URLSearchParams(searchParams.toString());
                    if (v) sp.set("status", v);
                    else sp.delete("status");
                    const nq = sp.toString();
                    router.replace(nq ? `${pathname}?${nq}` : pathname, { scroll: false });
                  }
                }}
              >
                <option value="">Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="hold">Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="overdue">Overdue</option>
              </select>
              <select
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <select
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
                value={zoneFilter}
                onChange={(e) => {
                  setZoneFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Location</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
              />
            </div>
            <button
              type="button"
              className="text-sm font-semibold text-[#2B4C7E] hover:underline"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>

          <div className="app-data-shell mt-4">
            {listLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-pulse-muted">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Loading requests…
              </div>
            ) : listError ? (
              <p className="p-6 text-sm text-rose-600">{listError}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="app-table-head-row border-pulse-border">
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Asset &amp; ID</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Assigned To</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const desc = (row.description ?? "").replace(/\s+/g, " ").trim();
                      const short = desc.length > 72 ? `${desc.slice(0, 72)}…` : desc || "—";
                      const overdueStyle = row.is_overdue ? "font-semibold text-[#c53030]" : "text-pulse-navy";
                      return (
                        <tr
                          key={row.id}
                          className="ds-table-row-hover cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-ds-border"
                          onClick={() => setDetailId(row.id)}
                        >
                          <td className="px-4 py-3 align-top">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${statusBadgeClass(row.display_status)}`}
                            >
                              <StatusIcon display={row.display_status} />
                              {row.display_status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${priorityBadgeClass(row.priority)}`}
                            >
                              <PriorityIcon p={row.priority} />
                              {row.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <p className="font-semibold text-pulse-navy">{row.asset_name ?? "—"}</p>
                            <p className="text-xs text-pulse-muted">{row.asset_tag ?? row.tool_id ?? ""}</p>
                            {row.equipment_name ? (
                              <p className="mt-0.5 text-xs text-pulse-muted">
                                Equipment:{" "}
                                <span className="font-medium text-pulse-navy">{row.equipment_name}</span>
                              </p>
                            ) : null}
                            {row.part_name ? (
                              <p className="mt-0.5 text-xs text-pulse-muted">
                                Part: <span className="font-medium text-pulse-navy">{row.part_name}</span>
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-top text-pulse-navy">{row.location_name ?? "—"}</td>
                          <td className="px-4 py-3 align-top text-pulse-navy">{row.category ?? "—"}</td>
                          <td className="max-w-[220px] px-4 py-3 align-top text-pulse-muted">{short}</td>
                          <td className="px-4 py-3 align-top">
                            {row.assignee_name || row.assigned_user_id ? (
                              <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-pulse-navy ring-1 ring-slate-200/60">
                                  {initials(row.assignee_name, row.assignee_email ?? null)}
                                </span>
                                <span className="text-pulse-navy">{row.assignee_name ?? row.assigned_user_id}</span>
                              </div>
                            ) : (
                              <span className="italic text-pulse-muted">Unassigned</span>
                            )}
                          </td>
                          <td className={`px-4 py-3 align-top tabular-nums ${overdueStyle}`}>
                            {formatDue(row.due_date)}
                          </td>
                          <td className="relative px-4 py-3 text-right align-top" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-pulse-navy hover:bg-slate-50 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                              aria-label="Row actions"
                              onClick={() => setMenuFor((m) => (m === row.id ? null : row.id))}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {menuFor === row.id ? (
                              <div className="absolute right-4 z-30 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg dark:border-ds-border dark:bg-ds-elevated">
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                                  onClick={() => {
                                    setMenuFor(null);
                                    setDetailId(row.id);
                                  }}
                                >
                                  View details
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                                  onClick={() => void quickStatus(row.id, "in_progress")}
                                >
                                  Mark in progress
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                                  onClick={() => void quickStatus(row.id, "hold")}
                                >
                                  Mark on hold
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                                  onClick={() => void quickStatus(row.id, "open")}
                                >
                                  Mark open
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                                  onClick={() => void quickStatus(row.id, "completed")}
                                >
                                  Mark completed
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
            <div className="flex flex-col gap-2 border-t border-pulse-border px-4 py-3 text-sm text-pulse-muted dark:border-ds-border sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {start}–{end} of {total} requests
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-pulse-navy disabled:opacity-40 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
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
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-pulse-navy disabled:opacity-40 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border border-rose-200/80 bg-[#fff5f5] p-5 shadow-sm dark:border-red-500/35 dark:bg-red-950/45 lg:col-span-2">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#c53030] text-white dark:bg-red-600">
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-rose-900 dark:text-red-100">Overdue Critical Tasks</h2>
                  <p className="mt-1 text-sm text-rose-900/85 dark:text-red-100/90">
                    There {overdueCritical === 1 ? "is" : "are"} {overdueCritical} critical work{" "}
                    {overdueCritical === 1 ? "request" : "requests"} past due that need immediate attention.
                  </p>
                  <button
                    type="button"
                    className="mt-4 rounded-[10px] bg-[#9b2c2c] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#822727]"
                    onClick={applyCriticalView}
                  >
                    View critical tasks
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-md border border-pulse-border bg-white p-5 shadow-sm ring-1 ring-slate-100/80 border-l-4 border-l-[#2B4C7E] dark:border-ds-border dark:bg-ds-primary dark:ring-white/[0.06] dark:border-l-[#3B82F6]">
              <span className="text-xs font-semibold uppercase tracking-wide text-pulse-muted dark:text-gray-400">Total requests</span>
              <p className="mt-3 text-3xl font-bold tabular-nums text-pulse-navy dark:text-gray-100">{total}</p>
              <p className="mt-1 text-sm text-pulse-muted">In current filter scope</p>
            </div>
          </div>
        </>
      )}

      {menuFor ? (
        <button
          type="button"
          className="fixed inset-0 z-20 cursor-default bg-transparent"
          aria-label="Close menu"
          onClick={() => setMenuFor(null)}
        />
      ) : null}

      <PulseDrawer
        open={createOpen}
        title="New work request"
        subtitle="Create a maintenance task for your team"
        onClose={() => setCreateOpen(false)}
        wide
        labelledBy="wr-create-title"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-pulse-muted hover:text-pulse-navy"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className={PRIMARY_BTN} disabled={actionBusy} onClick={() => void onCreateSubmit()}>
              {actionBusy ? "Saving…" : "Create request"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p id="wr-create-title" className="sr-only">
            New work request
          </p>
          <div>
            <label className={LABEL}>Title</label>
            <input
              className={FIELD}
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <textarea
              className={`${FIELD} min-h-[100px]`}
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Asset</label>
              <select
                className={FIELD}
                value={createForm.tool_id}
                onChange={(e) => setCreateForm((f) => ({ ...f, tool_id: e.target.value }))}
              >
                <option value="">Select asset…</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Equipment</label>
              <select
                className={FIELD}
                value={createForm.equipment_id}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, equipment_id: e.target.value, part_id: "" }))
                }
              >
                <option value="">None</option>
                {equipmentOptions.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Part (optional)</label>
              <select
                className={FIELD}
                value={createForm.part_id}
                disabled={!createForm.equipment_id || wrPartOptions.length === 0}
                onChange={(e) => setCreateForm((f) => ({ ...f, part_id: e.target.value }))}
              >
                <option value="">None</option>
                {wrPartOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Location</label>
              <select
                className={FIELD}
                value={createForm.zone_id}
                onChange={(e) => setCreateForm((f) => ({ ...f, zone_id: e.target.value }))}
              >
                <option value="">Select zone…</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Category</label>
              <input
                className={FIELD}
                value={createForm.category}
                onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div>
              <label className={LABEL}>Priority</label>
              <select
                className={FIELD}
                value={createForm.priority}
                onChange={(e) => setCreateForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Assign to</label>
              <select
                className={FIELD}
                value={createForm.assigned_user_id}
                onChange={(e) => setCreateForm((f) => ({ ...f, assigned_user_id: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name ?? w.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Due date</label>
              <input
                type="date"
                className={FIELD}
                value={createForm.due_date}
                onChange={(e) => setCreateForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className={LABEL}>Attachments (optional — one note per line)</label>
            <textarea
              className={`${FIELD} min-h-[72px]`}
              placeholder="Reference numbers, URLs, or file locations"
              value={createForm.attachmentsNotes}
              onChange={(e) => setCreateForm((f) => ({ ...f, attachmentsNotes: e.target.value }))}
            />
          </div>
        </div>
      </PulseDrawer>

      <PulseDrawer
        open={Boolean(detailId)}
        title={detail?.title ?? "Work request"}
        subtitle={detail ? `Updated ${new Date(detail.updated_at).toLocaleString()}` : undefined}
        onClose={closeDetail}
        wide
        labelledBy="wr-detail-title"
      >
        {detailLoading || !detail ? (
          <div className="flex items-center gap-2 text-pulse-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="space-y-6">
            <p id="wr-detail-title" className="sr-only">
              {detail.title}
            </p>
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${statusBadgeClass(detail.display_status)}`}
              >
                <StatusIcon display={detail.display_status} />
                {detail.display_status.replace(/_/g, " ")}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${priorityBadgeClass(detail.priority)}`}
              >
                <PriorityIcon p={detail.priority} />
                {detail.priority}
              </span>
            </div>
            <div>
              <h3 className={LABEL}>Description</h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-pulse-navy">{detail.description ?? "—"}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className={LABEL}>Assigned</h3>
                <p className="mt-1.5 text-sm text-pulse-navy">{detail.assignee_name ?? "Unassigned"}</p>
              </div>
              <div>
                <h3 className={LABEL}>Due date</h3>
                <p
                  className={`mt-1.5 text-sm tabular-nums ${detail.is_overdue ? "font-semibold text-[#c53030]" : "text-pulse-navy"}`}
                >
                  {formatDue(detail.due_date)}
                </p>
              </div>
              <div>
                <h3 className={LABEL}>Asset</h3>
                <p className="mt-1.5 text-sm font-medium text-pulse-navy">{detail.asset_name ?? "—"}</p>
                <p className="text-xs text-pulse-muted">{detail.asset_tag ?? detail.tool_id ?? ""}</p>
              </div>
              <div>
                <h3 className={LABEL}>Location</h3>
                <p className="mt-1.5 text-sm text-pulse-navy">{detail.location_name ?? "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <h3 className={LABEL}>Linked equipment</h3>
                {detail.equipment_id && detail.equipment_name ? (
                  <p className="mt-1.5 text-sm font-medium text-pulse-navy">
                    <Link
                      href={`/equipment/${encodeURIComponent(detail.equipment_id)}`}
                      className="text-[#2B4C7E] underline-offset-2 hover:underline"
                    >
                      {detail.equipment_name}
                    </Link>
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm text-pulse-muted">None</p>
                )}
                {canManage ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <label className={LABEL} htmlFor="wr-detail-equipment">
                        Change link
                      </label>
                      <select
                        id="wr-detail-equipment"
                        className={FIELD}
                        value={detailEquipmentDraft}
                        onChange={(e) => setDetailEquipmentDraft(e.target.value)}
                      >
                        <option value="">None</option>
                        {equipmentOptions.map((eq) => (
                          <option key={eq.id} value={eq.id}>
                            {eq.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className={PRIMARY_BTN}
                      disabled={
                        actionBusy || (detailEquipmentDraft || "") === (detail.equipment_id ?? "")
                      }
                      onClick={() => void saveDetailEquipment()}
                    >
                      Save link
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <h3 className={LABEL}>Linked part</h3>
                <p className="mt-1.5 text-sm text-pulse-navy">{detail.part_name ?? "—"}</p>
              </div>
            </div>

            <div>
              <h3 className={LABEL}>Activity</h3>
              <ul className="mt-2 space-y-2 border-l-2 border-slate-200 pl-4">
                {detail.activity.length === 0 ? (
                  <li className="text-sm text-pulse-muted">No activity yet.</li>
                ) : (
                  detail.activity.map((a) => (
                    <li key={a.id} className="text-sm">
                      <span className="font-semibold text-pulse-navy">{a.action.replace(/_/g, " ")}</span>
                      <span className="text-pulse-muted">
                        {" "}
                        · {a.performer_name ?? "—"} · {new Date(a.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div>
              <h3 className={LABEL}>Attachments</h3>
              {detail.attachments.length === 0 ? (
                <p className="mt-1.5 text-sm text-pulse-muted">None</p>
              ) : (
                <ul className="mt-2 list-disc pl-5 text-sm text-pulse-navy">
                  {detail.attachments.map((x, i) => (
                    <li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className={LABEL}>Comments</h3>
              <div className="mt-2 space-y-3">
                {detail.comments.map((c) => (
                  <div key={c.id} className="rounded-lg border border-slate-200/90 bg-white p-3 dark:border-ds-border dark:bg-ds-secondary">
                    <p className="text-xs text-pulse-muted">
                      {c.user_name ?? c.user_id} · {new Date(c.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm text-pulse-navy">{c.message}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <textarea
                  className={`${FIELD} min-h-[72px]`}
                  placeholder="Add a comment…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <button
                  type="button"
                  className={`${PRIMARY_BTN} mt-2`}
                  disabled={actionBusy || !commentText.trim()}
                  onClick={() => void submitComment()}
                >
                  Post comment
                </button>
              </div>
            </div>
          </div>
        )}
      </PulseDrawer>

      <PulseDrawer
        open={settingsOpen}
        title="Work request settings"
        subtitle="Statuses, priorities, SLA defaults, routing, and notification toggles"
        onClose={() => setSettingsOpen(false)}
        wide
        elevated
        labelledBy="wr-settings-title"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-pulse-muted hover:text-pulse-navy"
              onClick={() => setSettingsOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className={PRIMARY_BTN} disabled={actionBusy} onClick={() => void saveSettings()}>
              Save &amp; close
            </button>
          </div>
        }
      >
        {settingsLoading || !settingsDraft ? (
          <p className="text-sm text-pulse-muted">Loading settings…</p>
        ) : (
          <div className="mx-auto max-w-xl space-y-5">
            <p id="wr-settings-title" className="sr-only">
              Work request settings
            </p>
            <div>
              <p className={LABEL}>Section</p>
              <div className="mt-1.5 flex flex-wrap gap-1 rounded-[10px] border border-slate-200/80 bg-slate-100/85 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                {SETTINGS_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSettingsTab(t)}
                    className={`rounded-lg px-2.5 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
                      settingsTab === t
                        ? "bg-white text-[#2B4C7E] shadow-sm ring-1 ring-slate-200/90 dark:bg-[#1e3a5f] dark:text-sky-100 dark:ring-sky-500/35"
                        : "text-pulse-muted hover:bg-white/70 hover:text-pulse-navy dark:text-gray-400 dark:hover:bg-ds-interactive-hover"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {settingsTab === "Statuses" ? (
              <div className="space-y-3">
                {(["open", "in_progress", "hold", "completed", "cancelled"] as const).map((k) => (
                  <label key={k} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2 dark:border-ds-border dark:bg-ds-secondary">
                    <span className="text-sm font-medium capitalize text-pulse-navy">{k.replace(/_/g, " ")}</span>
                    <input
                      type="checkbox"
                      checked={settingsDraft.statuses?.[k] !== false}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s!,
                          statuses: { ...defaultSettings.statuses, ...s!.statuses, [k]: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </label>
                ))}
              </div>
            ) : null}

            {settingsTab === "Priorities & SLA" ? (
              <div className="space-y-4">
                {(["low", "medium", "high", "critical"] as const).map((k) => (
                  <div key={k} className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={LABEL}>{k} — color</label>
                      <input
                        type="text"
                        className={FIELD}
                        value={settingsDraft.priority_colors?.[k] ?? defaultSettings.priority_colors[k]}
                        onChange={(e) =>
                          setSettingsDraft((s) => ({
                            ...s!,
                            priority_colors: { ...defaultSettings.priority_colors, ...s!.priority_colors, [k]: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className={LABEL}>{k} — SLA (hours)</label>
                      <input
                        type="number"
                        className={FIELD}
                        value={settingsDraft.sla_hours?.[k] ?? defaultSettings.sla_hours[k]}
                        onChange={(e) =>
                          setSettingsDraft((s) => ({
                            ...s!,
                            sla_hours: {
                              ...defaultSettings.sla_hours,
                              ...s!.sla_hours,
                              [k]: Number(e.target.value),
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {settingsTab === "Assignment" ? (
              <div>
                <label className={LABEL}>Default assignment</label>
                <select
                  className={FIELD}
                  value={settingsDraft.assignment_rules?.default_by ?? "asset"}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s!,
                      assignment_rules: { ...defaultSettings.assignment_rules, ...s!.assignment_rules, default_by: e.target.value },
                    }))
                  }
                >
                  <option value="asset">By asset</option>
                  <option value="location">By location</option>
                </select>
              </div>
            ) : null}

            {settingsTab === "Notifications" ? (
              <div className="space-y-3">
                {(["new_request", "assignment", "overdue"] as const).map((k) => (
                  <label key={k} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2 dark:border-ds-border dark:bg-ds-secondary">
                    <span className="text-sm font-medium text-pulse-navy capitalize">{k.replace(/_/g, " ")}</span>
                    <input
                      type="checkbox"
                      checked={settingsDraft.notifications?.[k] !== false}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s!,
                          notifications: { ...defaultSettings.notifications, ...s!.notifications, [k]: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </PulseDrawer>
    </div>
  );
}
