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
  MapPin,
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
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { ModuleSettingsModal } from "@/components/module-settings/ModuleSettingsModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageBody } from "@/components/ui/PageBody";
import { managerOrAbove } from "@/lib/pulse-roles";
import { isTenantNavFeatureEnabled } from "@/lib/pulse-nav-features";
import { isTenantNavPermissionGranted } from "@/lib/pulse-nav-permissions";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { readSession } from "@/lib/pulse-session";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { fetchWorkerSettings } from "@/lib/workersService";
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
  postWorkRequestAssign,
} from "@/lib/workRequestsService";
import { createPmPlan, type PmPlanFrequency } from "@/lib/pmPlansService";
import { useModuleSettings, useModuleSettingsOptional } from "@/providers/ModuleSettingsProvider";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type CompanyOption = { id: string; name: string };
type ZoneOpt = { id: string; name: string };
type AssetOpt = { id: string; name: string; tag_id?: string | null; zone_id?: string | null };
type EquipmentOpt = { id: string; name: string };
type WrPartOpt = { id: string; name: string };
type WorkerOpt = { id: string; email: string; full_name: string | null; role: string };

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");
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

type WorkItemStatus =
  | "pending_approval"
  | "approved"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "overdue";

const WORKFLOW_STATUSES: { id: WorkItemStatus; label: string }[] = [
  { id: "pending_approval", label: "Pending approval" },
  { id: "approved", label: "Approved" },
  { id: "assigned", label: "Assigned" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "overdue", label: "Overdue" },
];

/** Category sources — maps to `hub_category` / `kind` list params (same semantics as the retired hub chips). */
const WR_CATEGORY_CHIPS = [
  { id: "", label: "All" },
  /** Backend treats `preventative` as work_order_type preventative OR kind preventative_maintenance. */
  { id: "preventative", label: "Preventative / PM" },
  { id: "work_requests", label: "Work requests" },
  { id: "projects", label: "Projects" },
] as const;

function wrFilterChipClass(active: boolean): string {
  return active
    ? "border-ds-accent bg-ds-accent/15 text-ds-foreground ring-1 ring-ds-accent/30"
    : "border-ds-border bg-ds-secondary/60 text-ds-muted hover:border-ds-border hover:bg-ds-interactive-hover hover:text-ds-foreground";
}

/** Preset keys stored on activity `meta.hold_reason` when placing a request on hold. */
const WORK_REQUEST_HOLD_REASONS: { id: string; label: string }[] = [
  { id: "awaiting_parts", label: "On hold — awaiting parts" },
  { id: "access", label: "On hold — access to area" },
  { id: "vendor", label: "On hold — vendor / contractor" },
  { id: "equipment", label: "On hold — equipment availability" },
  { id: "other", label: "Other" },
];

type WorkTab = "my_work" | "approval" | "all";

function isWorkItemStatus(v: string): v is WorkItemStatus {
  return WORKFLOW_STATUSES.some((s) => s.id === v);
}

function terminalRowStatus(status: string): boolean {
  return status === "completed" || status === "cancelled";
}

function activityStatusSummary(meta: Record<string, unknown>, action: string): string | null {
  if (action !== "status_changed") return null;
  const parts: string[] = [];
  const cr = meta.close_reason;
  if (typeof cr === "string" && cr.trim()) parts.push(`Close: ${cr.trim()}`);
  const hr = meta.hold_reason;
  if (typeof hr === "string" && hr.trim()) {
    const label = WORK_REQUEST_HOLD_REASONS.find((r) => r.id === hr)?.label ?? hr;
    parts.push(label);
  }
  const n = meta.note;
  if (typeof n === "string" && n.trim() && typeof hr === "string" && hr.trim()) parts.push(n.trim());
  return parts.length > 0 ? parts.join(" · ") : null;
}

function categoryCodeFromRow(row: WorkRequestRow): { code: "ISS" | "PM" | "SET"; category: "issue" | "preventative" | "setup" } {
  const k = (row.category_key ?? "").toLowerCase();
  if (k === "preventative") return { code: "PM", category: "preventative" };
  if (k === "setup") return { code: "SET", category: "setup" };
  return { code: "ISS", category: "issue" };
}

function workItemDisplayId(row: WorkRequestRow): string {
  const raw = (row.display_id ?? row.id).trim();
  if (/^[A-Z]{2,5}-\d{1,8}$/.test(raw)) return raw;
  const { code } = categoryCodeFromRow(row);
  return `${code}-${row.id.slice(0, 6).toUpperCase()}`;
}

const DEFAULT_WR_ACCESS_ROLES = ["manager", "supervisor"] as const;

function normalizeSettingsRoles(raw: string[] | undefined, fallback: readonly string[]): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...fallback];
  const out = raw.map((x) => String(x).trim()).filter(Boolean);
  return out.length ? [...new Set(out)] : [...fallback];
}

function userHasDelegatedWrEditRole(session: PulseAuthSession | null, editRoles: string[]): boolean {
  if (!session) return false;
  if (session.is_system_admin || sessionHasAnyRole(session, "system_admin", "company_admin")) return true;
  if (session.facility_tenant_admin) return true;
  return sessionHasAnyRole(session, ...editRoles);
}

function userCanEditWorkRequest(
  session: PulseAuthSession | null,
  wr: Pick<WorkRequestRow, "created_by_user_id">,
  editRoles: string[],
): boolean {
  if (!session) return false;
  if (userHasDelegatedWrEditRole(session, editRoles)) return true;
  if (wr.created_by_user_id && wr.created_by_user_id === session.sub) return true;
  return false;
}

function userCanManageFacilityZones(session: PulseAuthSession | null, zoneRoles: string[]): boolean {
  return userHasDelegatedWrEditRole(session, zoneRoles);
}

export function WorkRequestsApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hubQ = searchParams.get("hub") ?? "";
  const kindQ = searchParams.get("kind") ?? "";
  const statusQ = searchParams.get("status") ?? "";
  useModuleSettings("workRequests");
  const moduleSettingsCtx = useModuleSettingsOptional();
  const session = readSession();
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const sessionCompanyId = session?.company_id ?? null;
  const canManage = managerOrAbove(session);
  const canApprove = sessionHasAnyRole(session, "supervisor", "manager", "company_admin");
  const [wrEditAccessRoles, setWrEditAccessRoles] = useState<string[]>([...DEFAULT_WR_ACCESS_ROLES]);
  const [zoneManageAccessRoles, setZoneManageAccessRoles] = useState<string[]>([...DEFAULT_WR_ACCESS_ROLES]);
  const hasWorkRequestEditRole = useMemo(
    () => userHasDelegatedWrEditRole(session, wrEditAccessRoles),
    [session, wrEditAccessRoles],
  );
  const canManageZones = useMemo(
    () => userCanManageFacilityZones(session, zoneManageAccessRoles),
    [session, zoneManageAccessRoles],
  );
  const canEditWorkRequest = useCallback(
    (wr: Pick<WorkRequestRow, "created_by_user_id">) => userCanEditWorkRequest(session, wr, wrEditAccessRoles),
    [session, wrEditAccessRoles],
  );
  const canAccessWorkRequests = useMemo(() => {
    if (isSystemAdmin) return true;
    // Role-based module access is enforced server-side and reflected in `/auth/me`:
    // - `enabled_features` controls which modules the tenant can use
    // - `permissions` controls who can open which modules (configured via Workers & Roles)
    if (!session) return false;
    if (!sessionCompanyId) return false;
    if (!isTenantNavFeatureEnabled("/dashboard/work-requests", session.enabled_features)) return false;
    return isTenantNavPermissionGranted("/dashboard/work-requests", session.permissions);
  }, [isSystemAdmin, session, sessionCompanyId]);

  const [companyPick, setCompanyPick] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const effectiveCompanyId = isSystemAdmin ? companyPick : sessionCompanyId;
  const dataEnabled = Boolean(effectiveCompanyId) && canAccessWorkRequests;

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [hubCategoryFilter, setHubCategoryFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const defaultTab: WorkTab = useMemo(() => {
    if (session && sessionHasAnyRole(session, "worker") && !canApprove && !hasWorkRequestEditRole) return "my_work";
    return "approval";
  }, [session, canApprove, hasWorkRequestEditRole]);

  const [tab, setTab] = useState<WorkTab>(defaultTab);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

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
  const [kpiSummary, setKpiSummary] = useState<{ pending: number; inProgress: number; overdueAny: number } | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pmCreateOpen, setPmCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("Statuses");
  const [settingsDraft, setSettingsDraft] = useState<WrSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [orgSettingsOpen, setOrgSettingsOpen] = useState(false);
  const [headerSettingsOpen, setHeaderSettingsOpen] = useState(false);
  const [headerSettingsAnchor, setHeaderSettingsAnchor] = useState<{ top: number; left: number } | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const [closeModalForId, setCloseModalForId] = useState<string | null>(null);
  const [closeReasonDraft, setCloseReasonDraft] = useState("");
  const [holdModalForId, setHoldModalForId] = useState<string | null>(null);
  const [holdReasonKey, setHoldReasonKey] = useState<string>(WORK_REQUEST_HOLD_REASONS[0]!.id);
  const [holdNoteDraft, setHoldNoteDraft] = useState("");
  const [assignModalForId, setAssignModalForId] = useState<string | null>(null);
  const [assignPickUserId, setAssignPickUserId] = useState("");

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

  const PM_SUGGESTIONS = useMemo(
    () => [
      "Check HVAC filters",
      "Inspect boiler pressure",
      "Test emergency lighting",
      "Inspect fire extinguishers",
      "Check for water leaks",
      "Inspect rooftop units",
    ],
    [],
  );

  const [pmTitle, setPmTitle] = useState("");
  const [pmDescription, setPmDescription] = useState("");
  const [pmFrequency, setPmFrequency] = useState<PmPlanFrequency>("monthly");
  const [pmCustomDays, setPmCustomDays] = useState("30");
  const [pmStartDate, setPmStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pmDueOffset, setPmDueOffset] = useState("0");
  const [pmAssignedTo, setPmAssignedTo] = useState("");
  const [pmSuggestOpen, setPmSuggestOpen] = useState(false);
  const pmTitleWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pmSuggestOpen) return;
    const close = (e: MouseEvent) => {
      if (pmTitleWrapRef.current && !pmTitleWrapRef.current.contains(e.target as Node)) {
        setPmSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pmSuggestOpen]);

  const pmSuggestions = useMemo(() => {
    const q = pmTitle.trim().toLowerCase();
    if (!q) return PM_SUGGESTIONS;
    const scored = PM_SUGGESTIONS.map((s) => {
      const sl = s.toLowerCase();
      const score = sl.includes(q) ? 2 : q.split(/\s+/).some((w) => w && sl.includes(w)) ? 1 : 0;
      return { s, score };
    })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s);
    return scored;
  }, [PM_SUGGESTIONS, pmTitle]);

  const [detailEquipmentDraft, setDetailEquipmentDraft] = useState("");
  const [detailZoneDraft, setDetailZoneDraft] = useState("");
  const [detailCategoryDraft, setDetailCategoryDraft] = useState("");
  const [detailDueDraft, setDetailDueDraft] = useState("");
  const [detailPriorityDraft, setDetailPriorityDraft] = useState("medium");
  const [zonesEditorOpen, setZonesEditorOpen] = useState(false);
  const [zoneNameDrafts, setZoneNameDrafts] = useState<Record<string, string>>({});
  const [newZoneName, setNewZoneName] = useState("");
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
      setWrEditAccessRoles([...DEFAULT_WR_ACCESS_ROLES]);
      setZoneManageAccessRoles([...DEFAULT_WR_ACCESS_ROLES]);
      return;
    }
    void (async () => {
      try {
        const wsPromise =
          effectiveCompanyId != null
            ? fetchWorkerSettings(isSystemAdmin ? effectiveCompanyId : null).catch(() => null)
            : Promise.resolve(null);
        const [z, a, w, eq, ws] = await Promise.all([
          apiFetch<ZoneOpt[]>(`/api/v1/pulse/zones`),
          apiFetch<AssetOpt[]>(`/api/v1/pulse/assets`),
          apiFetch<WorkerOpt[]>(`/api/v1/pulse/workers`),
          fetchEquipmentList({}).catch(() => []),
          wsPromise,
        ]);
        setZones(z);
        setAssets(a);
        setEquipmentOptions(eq.map((r) => ({ id: r.id, name: r.name })));
        setWorkers(w);
        if (ws?.settings) {
          setWrEditAccessRoles(normalizeSettingsRoles(ws.settings.work_request_edit_roles, DEFAULT_WR_ACCESS_ROLES));
          setZoneManageAccessRoles(normalizeSettingsRoles(ws.settings.zone_manage_roles, DEFAULT_WR_ACCESS_ROLES));
        } else {
          setWrEditAccessRoles([...DEFAULT_WR_ACCESS_ROLES]);
          setZoneManageAccessRoles([...DEFAULT_WR_ACCESS_ROLES]);
        }
      } catch {
        setZones([]);
        setAssets([]);
        setEquipmentOptions([]);
        setWorkers([]);
      }
    })();
  }, [dataEnabled, session?.access_token, effectiveCompanyId, isSystemAdmin]);

  useEffect(() => {
    if (!zonesEditorOpen) return;
    setZoneNameDrafts((prev) => {
      const next = { ...prev };
      for (const z of zones) {
        if (next[z.id] === undefined) next[z.id] = z.name;
      }
      for (const k of Object.keys(next)) {
        if (!zones.some((z) => z.id === k)) delete next[k];
      }
      return next;
    });
  }, [zonesEditorOpen, zones]);

  const wrFromUrl = searchParams.get("wr");

  useEffect(() => {
    if (!dataEnabled || !wrFromUrl?.trim()) return;
    setDetailId(wrFromUrl.trim());
  }, [dataEnabled, wrFromUrl]);

  const writeMaintenanceQuery = useCallback(
    (hub: string, kind: string, status: string) => {
      if (!pathname?.startsWith("/dashboard/maintenance")) return;
      const sp = new URLSearchParams(searchParams.toString());
      if (hub) sp.set("hub", hub);
      else sp.delete("hub");
      if (kind) sp.set("kind", kind);
      else sp.delete("kind");
      if (status) sp.set("status", status);
      else sp.delete("status");
      const nq = sp.toString();
      router.replace(nq ? `${pathname}?${nq}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!pathname?.startsWith("/dashboard/maintenance")) {
      setHubCategoryFilter("");
      setKindFilter("");
      return;
    }
    // Legacy URLs used `kind=preventative_maintenance` alone; merged category uses `hub=preventative`.
    if ((!hubQ && kindQ === "preventative_maintenance") || (hubQ === "preventative" && kindQ === "preventative_maintenance")) {
      setHubCategoryFilter("preventative");
      setKindFilter("");
      setStatusFilter(statusQ);
      setPage(0);
      writeMaintenanceQuery("preventative", "", statusQ);
      return;
    }
    setHubCategoryFilter(hubQ);
    setKindFilter(kindQ);
    setStatusFilter(statusQ);
    setPage(0);
  }, [pathname, hubQ, kindQ, statusQ, writeMaintenanceQuery]);

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

  const loadList = useCallback(
    async (opts?: { hub_category?: string; kind?: string; status?: string }) => {
      if (!dataEnabled || !effectiveCompanyId) return;
      setListLoading(true);
      setListError(null);
      try {
        const effStatus = opts?.status !== undefined ? opts.status : statusFilter;
        const effHub = opts?.hub_category !== undefined ? opts.hub_category : hubCategoryFilter;
        const effKind = opts?.kind !== undefined ? opts.kind : kindFilter;
        const due_after = dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined;
        const due_before = dateTo ? `${dateTo}T23:59:59.999Z` : undefined;
        const res = await fetchWorkRequestList({
          companyId: isSystemAdmin ? effectiveCompanyId : null,
          q: qDebounced || undefined,
          status: effStatus || undefined,
          exclude_terminal: effStatus ? undefined : true,
          priority: priorityFilter || undefined,
          zone_id: zoneFilter || undefined,
          hub_category: effHub ? effHub : undefined,
          kind: effKind ? effKind : undefined,
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
    },
    [
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
      hubCategoryFilter,
      kindFilter,
    ],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!dataEnabled || !effectiveCompanyId || overdueCritical !== 0) {
      setKpiLoading(false);
      if (overdueCritical !== 0) setKpiSummary(null);
      return;
    }
    let cancelled = false;
    setKpiLoading(true);
    void (async () => {
      try {
        const companyId = isSystemAdmin ? effectiveCompanyId : null;
        const due_after = dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined;
        const due_before = dateTo ? `${dateTo}T23:59:59.999Z` : undefined;
        const common = {
          companyId,
          q: qDebounced || undefined,
          priority: priorityFilter || undefined,
          zone_id: zoneFilter || undefined,
          hub_category: hubCategoryFilter || undefined,
          kind: kindFilter || undefined,
          due_after,
          due_before,
          limit: 1,
          offset: 0,
        };
        const [pendingRes, inProgressRes, overdueRes] = await Promise.all([
          fetchWorkRequestList({ ...common, status: "pending_approval" }),
          fetchWorkRequestList({ ...common, status: "in_progress" }),
          fetchWorkRequestList({ ...common, status: "overdue" }),
        ]);
        if (!cancelled) {
          setKpiSummary({
            pending: pendingRes.total,
            inProgress: inProgressRes.total,
            overdueAny: overdueRes.total,
          });
        }
      } catch {
        if (!cancelled) setKpiSummary(null);
      } finally {
        if (!cancelled) setKpiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    dataEnabled,
    effectiveCompanyId,
    isSystemAdmin,
    overdueCritical,
    qDebounced,
    priorityFilter,
    zoneFilter,
    hubCategoryFilter,
    kindFilter,
    dateFrom,
    dateTo,
  ]);

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
      setDetailZoneDraft(detail.zone_id ?? "");
      setDetailCategoryDraft(detail.category ?? "");
      setDetailDueDraft(detail.due_date ? detail.due_date.slice(0, 10) : "");
      setDetailPriorityDraft(detail.priority ?? "medium");
    } else {
      setDetailEquipmentDraft("");
      setDetailZoneDraft("");
      setDetailCategoryDraft("");
      setDetailDueDraft("");
      setDetailPriorityDraft("medium");
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
    setStatusFilter("");
    setHubCategoryFilter("");
    setKindFilter("");
    writeMaintenanceQuery("", "", "");
  }

  function categoryChipActive(c: (typeof WR_CATEGORY_CHIPS)[number]): boolean {
    if (c.id === "") return !hubCategoryFilter && !kindFilter;
    if (c.id === "preventative") {
      return hubCategoryFilter === "preventative" || kindFilter === "preventative_maintenance";
    }
    return hubCategoryFilter === c.id && !kindFilter;
  }

  function applyCategoryChip(c: (typeof WR_CATEGORY_CHIPS)[number]) {
    setPage(0);
    let nextHub = "";
    let nextKind = "";
    if (c.id === "preventative") nextHub = "preventative";
    else if (c.id) nextHub = c.id;
    setHubCategoryFilter(nextHub);
    setKindFilter(nextKind);
    writeMaintenanceQuery(nextHub, nextKind, statusFilter);
  }

  function applyStatusChip(nextStatus: string) {
    setPage(0);
    setStatusFilter(nextStatus);
    writeMaintenanceQuery(hubCategoryFilter, kindFilter, nextStatus);
  }

  function applyCriticalView() {
    setStatusFilter("overdue");
    setPriorityFilter("critical");
    setPage(0);
    writeMaintenanceQuery(hubCategoryFilter, kindFilter, "overdue");
  }

  const filteredRows = useMemo(() => {
    const me = session?.sub ?? null;
    const list = [...rows];
    const st = (r: WorkRequestRow) => (isWorkItemStatus(r.status) ? r.status : ("pending_approval" as WorkItemStatus));

    if (tab === "my_work") {
      return list.filter((r) => r.assigned_user_id && me && r.assigned_user_id === me).filter((r) => {
        const s = st(r);
        return s === "assigned" || s === "in_progress";
      });
    }
    if (tab === "approval") {
      return list.filter((r) => {
        const s = st(r);
        return s === "pending_approval" || s === "approved";
      });
    }
    // all
    if (canApprove || hasWorkRequestEditRole || isSystemAdmin) return list;
    // workers who somehow reach All tab still only see assigned/in-progress
    return list.filter((r) => r.assigned_user_id && me && r.assigned_user_id === me).filter((r) => {
      const s = st(r);
      return s === "assigned" || s === "in_progress";
    });
  }, [rows, tab, session?.sub, canApprove, hasWorkRequestEditRole, isSystemAdmin]);

  async function approveItem(id: string) {
    if (!effectiveCompanyId || !canApprove) return;
    setActionBusy(true);
    try {
      await postWorkRequestStatus(isSystemAdmin ? effectiveCompanyId : null, id, "approved");
      await loadList();
      if (detailId === id) await loadDetail();
    } finally {
      setActionBusy(false);
    }
  }

  async function rejectItem(id: string) {
    if (!effectiveCompanyId || !canApprove) return;
    setActionBusy(true);
    try {
      // No dedicated "rejected" status in the requested model; map to cancelled to avoid creating a new backend state.
      await postWorkRequestStatus(isSystemAdmin ? effectiveCompanyId : null, id, "cancelled", {
        note: "Rejected during approval",
      });
      await loadList();
      if (detailId === id) await loadDetail();
    } finally {
      setActionBusy(false);
    }
  }

  async function assignItem(id: string, userId: string | null): Promise<boolean> {
    if (!effectiveCompanyId) return false;
    const wr = rows.find((r) => r.id === id) ?? (detail?.id === id ? detail : null);
    if (!wr || !canEditWorkRequest(wr)) return false;
    setActionBusy(true);
    try {
      await postWorkRequestAssign(isSystemAdmin ? effectiveCompanyId : null, id, userId);
      await postWorkRequestStatus(isSystemAdmin ? effectiveCompanyId : null, id, userId ? "assigned" : "approved");
      await loadList();
      if (detailId === id) await loadDetail();
      return true;
    } finally {
      setActionBusy(false);
    }
  }

  async function startItem(id: string) {
    if (!effectiveCompanyId) return;
    setActionBusy(true);
    try {
      await postWorkRequestStatus(isSystemAdmin ? effectiveCompanyId : null, id, "in_progress");
      await loadList();
      if (detailId === id) await loadDetail();
    } finally {
      setActionBusy(false);
    }
  }

  async function completeItem(id: string) {
    if (!effectiveCompanyId) return;
    setActionBusy(true);
    try {
      await postWorkRequestStatus(isSystemAdmin ? effectiveCompanyId : null, id, "completed");
      await loadList();
      if (detailId === id) await loadDetail();
    } finally {
      setActionBusy(false);
    }
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
      const created = await createWorkRequest(isSystemAdmin ? effectiveCompanyId : null, {
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
      // Workflow default: pending approval, regardless of who created it.
      await postWorkRequestStatus(isSystemAdmin ? effectiveCompanyId : null, created.id, "pending_approval");
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

  async function saveDetailMetaFields() {
    if (!detailId || !detail || !effectiveCompanyId || !canEditWorkRequest(detail)) return;
    if (terminalRowStatus(detail.status)) return;
    setActionBusy(true);
    setListError(null);
    try {
      const dueIso = detailDueDraft.trim() ? `${detailDueDraft.trim()}T12:00:00.000Z` : null;
      await patchWorkRequest(isSystemAdmin ? effectiveCompanyId : null, detailId, {
        zone_id: detailZoneDraft.trim() || null,
        category: detailCategoryDraft.trim() || null,
        due_date: dueIso,
        priority: detailPriorityDraft,
      });
      await loadDetail();
      await loadList();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not save details");
    } finally {
      setActionBusy(false);
    }
  }

  async function saveDetailEquipment() {
    if (!detailId || !detail || !effectiveCompanyId || !canEditWorkRequest(detail)) return;
    if (terminalRowStatus(detail.status)) return;
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

  async function createZoneFromEditor() {
    const name = newZoneName.trim();
    if (!name || !canManageZones) return;
    setActionBusy(true);
    setListError(null);
    try {
      await apiFetch(`/api/v1/pulse/zones`, { method: "POST", json: { name } });
      setNewZoneName("");
      const z = await apiFetch<ZoneOpt[]>(`/api/v1/pulse/zones`);
      setZones(z);
      await loadList();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not add location");
    } finally {
      setActionBusy(false);
    }
  }

  async function saveZoneName(zoneId: string) {
    if (!canManageZones) return;
    const name = (zoneNameDrafts[zoneId] ?? "").trim();
    if (!name) return;
    setActionBusy(true);
    setListError(null);
    try {
      await apiFetch(`/api/v1/pulse/zones/${encodeURIComponent(zoneId)}`, {
        method: "PATCH",
        json: { name },
      });
      const z = await apiFetch<ZoneOpt[]>(`/api/v1/pulse/zones`);
      setZones(z);
      await loadList();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not rename location");
    } finally {
      setActionBusy(false);
    }
  }

  async function deleteZoneFromEditor(zoneId: string) {
    if (!canManageZones) return;
    if (
      !window.confirm(
        "Remove this location from the list? Existing work requests that reference it keep their link until you edit them.",
      )
    ) {
      return;
    }
    setActionBusy(true);
    setListError(null);
    try {
      await apiFetch(`/api/v1/pulse/zones/${encodeURIComponent(zoneId)}`, { method: "DELETE" });
      const z = await apiFetch<ZoneOpt[]>(`/api/v1/pulse/zones`);
      setZones(z);
      await loadList();
      if (detailId) await loadDetail();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not delete location");
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

  async function confirmCloseWorkRequest() {
    if (!effectiveCompanyId || !closeModalForId) return;
    const reason = closeReasonDraft.trim();
    if (!reason) return;
    const id = closeModalForId;
    setActionBusy(true);
    setListError(null);
    try {
      await postWorkRequestStatus(isSystemAdmin ? effectiveCompanyId : null, id, "cancelled", { note: reason });
      setCloseModalForId(null);
      setCloseReasonDraft("");
      setMenuFor(null);
      await loadList();
      if (detailId === id) await loadDetail();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not close request");
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmHoldWorkRequest() {
    if (!effectiveCompanyId || !holdModalForId) return;
    if (!holdReasonKey.trim()) return;
    const id = holdModalForId;
    setActionBusy(true);
    setListError(null);
    try {
      await postWorkRequestStatus(isSystemAdmin ? effectiveCompanyId : null, id, "hold", {
        hold_reason: holdReasonKey,
        note: holdNoteDraft.trim() || undefined,
      });
      setHoldModalForId(null);
      setHoldNoteDraft("");
      setHoldReasonKey(WORK_REQUEST_HOLD_REASONS[0]!.id);
      setMenuFor(null);
      await loadList();
      if (detailId === id) await loadDetail();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not place request on hold");
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

  const assignTargetWr =
    assignModalForId != null
      ? rows.find((x) => x.id === assignModalForId) ?? (detail?.id === assignModalForId ? detail : null)
      : null;
  const canSaveAssign = assignTargetWr != null && canEditWorkRequest(assignTargetWr);

  const detailMetaDirty = useMemo(() => {
    if (!detail) return false;
    const dueSlice = detail.due_date ? detail.due_date.slice(0, 10) : "";
    return (
      (detailZoneDraft || "") !== (detail.zone_id ?? "") ||
      (detailCategoryDraft || "") !== (detail.category ?? "") ||
      (detailDueDraft || "") !== dueSlice ||
      (detailPriorityDraft || "") !== (detail.priority ?? "")
    );
  }, [detail, detailZoneDraft, detailCategoryDraft, detailDueDraft, detailPriorityDraft]);

  if (!canAccessWorkRequests) {
    return (
      <p className="text-sm text-pulse-muted">
        You don&apos;t have access to Work Requests with this account. Access is managed under{" "}
        <Link href="/dashboard/workers" className="ds-link">
          Workers &amp; Roles
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Requests"
        description="Manage and monitor maintenance tasks across all zones."
        icon={ClipboardList}
        actions={
          <>
            {canManageZones ? (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm transition-colors hover:bg-slate-50 dark:border-ds-border dark:bg-ds-primary dark:text-slate-100 dark:hover:bg-ds-interactive-hover"
                onClick={() => setZonesEditorOpen(true)}
              >
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                Locations
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white p-2.5 text-pulse-navy shadow-sm transition-colors hover:bg-slate-50 dark:border-ds-border dark:bg-ds-primary dark:text-slate-100 dark:hover:bg-ds-interactive-hover"
              aria-label="Work request settings"
              title="Work request settings"
              onClick={(e) => {
                const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                setHeaderSettingsAnchor({ top: r.bottom + 8, left: Math.max(12, r.right - 240) });
                setHeaderSettingsOpen((v) => !v);
              }}
            >
              <Settings className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex items-center gap-2 px-4 py-2.5")}
              onClick={() => setPmCreateOpen(true)}
              disabled={!dataEnabled || !canManage}
              title={!canManage ? "Managers can create preventative maintenance plans" : undefined}
            >
              + New PM
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

      <PageBody>
      {headerSettingsOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[120] cursor-default bg-transparent"
          aria-label="Close settings menu"
          onClick={() => {
            setHeaderSettingsOpen(false);
            setHeaderSettingsAnchor(null);
          }}
        />
      ) : null}

      {headerSettingsOpen && headerSettingsAnchor ? (
        <div
          className="fixed z-[130] w-60 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg dark:border-ds-border dark:bg-ds-elevated"
          style={{ top: headerSettingsAnchor.top, left: headerSettingsAnchor.left }}
          role="menu"
          aria-label="Work request settings"
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
            onClick={() => {
              setHeaderSettingsOpen(false);
              setHeaderSettingsAnchor(null);
              setSettingsOpen(true);
            }}
          >
            Workflow &amp; notifications
          </button>
          {moduleSettingsCtx?.canConfigure ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
              onClick={() => {
                setHeaderSettingsOpen(false);
                setHeaderSettingsAnchor(null);
                setOrgSettingsOpen(true);
              }}
            >
              Organization rules
            </button>
          ) : null}
          {canManageZones ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
              onClick={() => {
                setHeaderSettingsOpen(false);
                setHeaderSettingsAnchor(null);
                setZonesEditorOpen(true);
              }}
            >
              Manage facility locations
            </button>
          ) : null}
        </div>
      ) : null}

      <ModuleSettingsModal moduleId="workRequests" open={orgSettingsOpen} onClose={() => setOrgSettingsOpen(false)} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("my_work")}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === "my_work" ? "border-[#2B4C7E] bg-[#2B4C7E]/10 text-[#2B4C7E]" : "border-slate-200 bg-white text-pulse-muted hover:bg-slate-50"
          }`}
        >
          Assigned to Me
        </button>
        {(canApprove || hasWorkRequestEditRole || isSystemAdmin) ? (
          <button
            type="button"
            onClick={() => setTab("approval")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === "approval" ? "border-[#2B4C7E] bg-[#2B4C7E]/10 text-[#2B4C7E]" : "border-slate-200 bg-white text-pulse-muted hover:bg-slate-50"
            }`}
          >
            Pending Approval
          </button>
        ) : null}
        {(canApprove || hasWorkRequestEditRole || isSystemAdmin) ? (
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === "all" ? "border-[#2B4C7E] bg-[#2B4C7E]/10 text-[#2B4C7E]" : "border-slate-200 bg-white text-pulse-muted hover:bg-slate-50"
            }`}
          >
            All Requests
          </button>
        ) : null}
      </div>

      {isSystemAdmin ? (
        <div className="mt-6 rounded-md border border-pulse-border bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-pulse-muted">Company</label>
          <select
            className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 md:w-auto"
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
          <div className="mt-6 rounded-lg border border-slate-200/90 bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
            <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-[min(100%,14rem)] flex-1 sm:max-w-md">
                  <label className={LABEL}>Search</label>
                  <div className="relative mt-1.5">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted" />
                    <input
                      type="search"
                      placeholder="Assets, requests, locations…"
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setPage(0);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-pulse-navy placeholder:text-slate-400 outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>
                <div className="min-w-[9rem]">
                  <label className={LABEL}>Priority</label>
                  <select
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
                    value={priorityFilter}
                    onChange={(e) => {
                      setPriorityFilter(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">All priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="min-w-[9rem]">
                  <label className={LABEL}>Location</label>
                  <select
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
                    value={zoneFilter}
                    onChange={(e) => {
                      setZoneFilter(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">All locations</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[9.5rem]">
                  <label className={LABEL}>Due from</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(0);
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
                  />
                </div>
                <div className="min-w-[9.5rem]">
                  <label className={LABEL}>Due to</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(0);
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
                  />
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 text-sm font-semibold text-[#2B4C7E] hover:underline dark:text-ds-success"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4 border-t border-slate-200/80 pt-4 dark:border-ds-border lg:flex-row lg:items-start lg:gap-8">
              <div className="min-w-0 flex-1">
                <p className={LABEL}>Category</p>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Category filters">
                  {WR_CATEGORY_CHIPS.map((c) => (
                    <button
                      key={c.id || "all-cat"}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${wrFilterChipClass(categoryChipActive(c))}`}
                      onClick={() => applyCategoryChip(c)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className={LABEL}>Status</p>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Status filters">
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${wrFilterChipClass(!statusFilter)}`}
                    onClick={() => applyStatusChip("")}
                  >
                    All active
                  </button>
                  {WORKFLOW_STATUSES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${wrFilterChipClass(statusFilter === s.id)}`}
                      onClick={() => applyStatusChip(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
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
                      <th className="px-4 py-3">Work item</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Assigned To</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
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
                            <p className="font-semibold text-pulse-navy">{workItemDisplayId(row)}</p>
                            <p className="mt-0.5 font-semibold text-pulse-navy">{row.title}</p>
                            <p className="text-xs text-pulse-muted">{row.asset_name ?? row.asset_tag ?? row.tool_id ?? ""}</p>
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
                              onClick={(e) => {
                                e.stopPropagation();
                                if (menuFor === row.id) {
                                  setMenuFor(null);
                                  setMenuAnchor(null);
                                  return;
                                }
                                const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setMenuAnchor({ top: r.bottom + 6, right: r.right });
                                setMenuFor(row.id);
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
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

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            {overdueCritical > 0 ? (
              <>
                <div className="rounded-md border border-rose-200/80 bg-[#fff5f5] p-5 shadow-sm dark:border-red-500/35 dark:bg-red-950/45 lg:col-span-3">
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
                  <span className="text-xs font-semibold uppercase tracking-wide text-pulse-muted dark:text-gray-400">
                    Total requests
                  </span>
                  <p className="mt-3 text-3xl font-bold tabular-nums text-pulse-navy dark:text-gray-100">{total}</p>
                  <p className="mt-1 text-sm text-pulse-muted">In current filter scope</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-md border border-pulse-border bg-white p-5 shadow-sm ring-1 ring-slate-100/80 border-l-4 border-l-amber-500/90 dark:border-ds-border dark:bg-ds-primary dark:ring-white/[0.06]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-pulse-muted dark:text-gray-400">
                    Pending approval
                  </span>
                  <p className="mt-3 flex min-h-[2.25rem] items-center text-3xl font-bold tabular-nums text-pulse-navy dark:text-gray-100">
                    {kpiLoading ? <Loader2 className="h-7 w-7 animate-spin text-pulse-muted" aria-hidden /> : kpiSummary?.pending ?? "—"}
                  </p>
                  <p className="mt-1 text-sm text-pulse-muted">Matches filters below</p>
                </div>
                <div className="rounded-md border border-pulse-border bg-white p-5 shadow-sm ring-1 ring-slate-100/80 border-l-4 border-l-sky-500/90 dark:border-ds-border dark:bg-ds-primary dark:ring-white/[0.06]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-pulse-muted dark:text-gray-400">
                    In progress
                  </span>
                  <p className="mt-3 flex min-h-[2.25rem] items-center text-3xl font-bold tabular-nums text-pulse-navy dark:text-gray-100">
                    {kpiLoading ? <Loader2 className="h-7 w-7 animate-spin text-pulse-muted" aria-hidden /> : kpiSummary?.inProgress ?? "—"}
                  </p>
                  <p className="mt-1 text-sm text-pulse-muted">Matches filters below</p>
                </div>
                <div className="rounded-md border border-pulse-border bg-white p-5 shadow-sm ring-1 ring-slate-100/80 border-l-4 border-l-rose-500/85 dark:border-ds-border dark:bg-ds-primary dark:ring-white/[0.06]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-pulse-muted dark:text-gray-400">
                    Overdue (any priority)
                  </span>
                  <p className="mt-3 flex min-h-[2.25rem] items-center text-3xl font-bold tabular-nums text-pulse-navy dark:text-gray-100">
                    {kpiLoading ? <Loader2 className="h-7 w-7 animate-spin text-pulse-muted" aria-hidden /> : kpiSummary?.overdueAny ?? "—"}
                  </p>
                  <p className="mt-1 text-sm text-pulse-muted">Matches filters below</p>
                </div>
                <div className="rounded-md border border-pulse-border bg-white p-5 shadow-sm ring-1 ring-slate-100/80 border-l-4 border-l-[#2B4C7E] dark:border-ds-border dark:bg-ds-primary dark:ring-white/[0.06] dark:border-l-[#3B82F6]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-pulse-muted dark:text-gray-400">
                    Total requests
                  </span>
                  <p className="mt-3 text-3xl font-bold tabular-nums text-pulse-navy dark:text-gray-100">{total}</p>
                  <p className="mt-1 text-sm text-pulse-muted">In current filter scope</p>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {menuFor ? (
        <button
          type="button"
          className="fixed inset-0 z-20 cursor-default bg-transparent"
          aria-label="Close menu"
          onClick={() => {
            setMenuFor(null);
            setMenuAnchor(null);
          }}
        />
      ) : null}

      {menuFor && menuAnchor ? (() => {
        const row = rows.find((r) => r.id === menuFor) ?? null;
        if (!row) return null;
        const left = Math.max(12, menuAnchor.right - 192); // 192px = w-48
        return (
          <div
            className="fixed z-[140] w-48 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg dark:border-ds-border dark:bg-ds-elevated"
            style={{ top: menuAnchor.top, left }}
            role="menu"
          >
            {row.status === "pending_approval" && canApprove ? (
              <>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                  onClick={() => void approveItem(row.id)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-slate-50 dark:text-rose-200 dark:hover:bg-ds-interactive-hover"
                  onClick={() => void rejectItem(row.id)}
                >
                  Reject
                </button>
              </>
            ) : null}
            {canEditWorkRequest(row) && !terminalRowStatus(row.status) ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                onClick={() => {
                  setMenuFor(null);
                  setMenuAnchor(null);
                  setAssignPickUserId(row.assigned_user_id ?? "");
                  setAssignModalForId(row.id);
                }}
              >
                Assign…
              </button>
            ) : null}
            {row.status === "assigned" ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                onClick={() => void startItem(row.id)}
              >
                Start work
              </button>
            ) : null}
            {row.status !== "pending_approval" && !terminalRowStatus(row.status) ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                onClick={() => {
                  setMenuFor(null);
                  setMenuAnchor(null);
                  void completeItem(row.id);
                }}
              >
                Complete
              </button>
            ) : null}
            {!terminalRowStatus(row.status) ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                onClick={() => {
                  setMenuFor(null);
                  setMenuAnchor(null);
                  setCloseReasonDraft("");
                  setCloseModalForId(row.id);
                }}
              >
                Close
              </button>
            ) : null}
            {!terminalRowStatus(row.status) && row.status !== "hold" ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                onClick={() => {
                  setMenuFor(null);
                  setMenuAnchor(null);
                  setHoldReasonKey(WORK_REQUEST_HOLD_REASONS[0]!.id);
                  setHoldNoteDraft("");
                  setHoldModalForId(row.id);
                }}
              >
                Hold
              </button>
            ) : null}
          </div>
        );
      })() : null}

      <PulseDrawer
        open={createOpen}
        title="New work request"
        subtitle="Create a maintenance task for your team"
        onClose={() => setCreateOpen(false)}
        wide
        placement="center"
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
        open={pmCreateOpen}
        title="New preventative maintenance"
        subtitle="Create a recurring PM in under 30 seconds"
        onClose={() => setPmCreateOpen(false)}
        wide
        placement="center"
        labelledBy="pm-create-title"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-pulse-muted hover:text-pulse-navy"
              onClick={() => setPmCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={PRIMARY_BTN}
              disabled={actionBusy || !pmTitle.trim()}
              onClick={async () => {
                if (!pmTitle.trim()) return;
                setActionBusy(true);
                setListError(null);
                try {
                  const custom_interval_days =
                    pmFrequency === "custom" ? Math.max(1, Number(pmCustomDays) || 1) : null;
                  await createPmPlan({
                    title: pmTitle.trim(),
                    description: pmDescription.trim() || null,
                    frequency: pmFrequency,
                    start_date: pmStartDate || null,
                    due_time_offset_days: pmDueOffset ? Math.max(0, Number(pmDueOffset) || 0) : null,
                    assigned_to: pmAssignedTo.trim() || null,
                    custom_interval_days,
                  });
                  setPmCreateOpen(false);
                  setHubCategoryFilter("preventative");
                  setKindFilter("");
                  setStatusFilter("");
                  writeMaintenanceQuery("preventative", "", "");
                  await loadList({
                    hub_category: "preventative",
                    kind: "",
                    status: "",
                  });
                } catch (e: unknown) {
                  setListError(e instanceof Error ? e.message : "Failed to create PM");
                } finally {
                  setActionBusy(false);
                }
              }}
            >
              {actionBusy ? "Saving…" : "Create PM"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p id="pm-create-title" className="sr-only">
            New preventative maintenance
          </p>
          <div ref={pmTitleWrapRef} className="relative">
            <label className={LABEL}>Title</label>
            <input
              className={FIELD}
              value={pmTitle}
              onFocus={() => setPmSuggestOpen(true)}
              onChange={(e) => {
                setPmTitle(e.target.value);
                setPmSuggestOpen(Boolean(e.target.value) ? true : true);
              }}
              placeholder="e.g. Inspect boiler pressure"
            />
            {pmSuggestOpen ? (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-ds-border bg-ds-primary shadow-lg">
                {pmSuggestions.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-ds-foreground hover:bg-ds-interactive-hover"
                    onClick={() => {
                      setPmTitle(s);
                      setPmSuggestOpen(false);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <label className={LABEL}>Description (optional)</label>
            <textarea
              className={`${FIELD} min-h-[90px]`}
              value={pmDescription}
              onChange={(e) => setPmDescription(e.target.value)}
              placeholder="Optional notes for the technician…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Frequency</label>
              <select
                className={FIELD}
                value={pmFrequency}
                onChange={(e) => setPmFrequency(e.target.value as PmPlanFrequency)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
                <option value="custom">Custom</option>
              </select>
              {pmFrequency === "custom" ? (
                <div className="mt-2">
                  <label className={LABEL}>Every N days</label>
                  <input className={FIELD} value={pmCustomDays} onChange={(e) => setPmCustomDays(e.target.value)} />
                </div>
              ) : null}
            </div>
            <div>
              <label className={LABEL}>Start date</label>
              <input className={FIELD} type="date" value={pmStartDate} onChange={(e) => setPmStartDate(e.target.value)} />
              <div className="mt-2">
                <label className={LABEL}>Due offset (days)</label>
                <input className={FIELD} value={pmDueOffset} onChange={(e) => setPmDueOffset(e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <label className={LABEL}>Assign to (optional)</label>
            <select className={FIELD} value={pmAssignedTo} onChange={(e) => setPmAssignedTo(e.target.value)}>
              <option value="">Unassigned</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {(w.full_name ?? w.email) || w.id}
                </option>
              ))}
            </select>
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
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-pulse-navy ring-1 ring-slate-200/80 dark:bg-ds-secondary dark:text-gray-100 dark:ring-ds-border">
                {workItemDisplayId(detail)}
              </span>
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
                {canEditWorkRequest(detail) && !terminalRowStatus(detail.status) ? (
                  <div className="mt-3">
                    <label className={LABEL}>Assign to</label>
                    <select
                      className={FIELD}
                      value={detail.assigned_user_id ?? ""}
                      onChange={(e) => void assignItem(detail.id, e.target.value || null)}
                    >
                      <option value="">Unassigned</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.full_name ?? w.email}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
              <div>
                <h3 className={LABEL}>Due date</h3>
                {canEditWorkRequest(detail) && !terminalRowStatus(detail.status) ? (
                  <input
                    type="date"
                    className={FIELD}
                    value={detailDueDraft}
                    onChange={(e) => setDetailDueDraft(e.target.value)}
                  />
                ) : (
                  <p
                    className={`mt-1.5 text-sm tabular-nums ${detail.is_overdue ? "font-semibold text-[#c53030]" : "text-pulse-navy"}`}
                  >
                    {formatDue(detail.due_date)}
                  </p>
                )}
              </div>
              <div>
                <h3 className={LABEL}>Priority</h3>
                {canEditWorkRequest(detail) && !terminalRowStatus(detail.status) ? (
                  <select
                    className={FIELD}
                    value={detailPriorityDraft}
                    onChange={(e) => setDetailPriorityDraft(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                ) : (
                  <p className="mt-1.5 text-sm capitalize text-pulse-navy">{detail.priority}</p>
                )}
              </div>
              <div>
                <h3 className={LABEL}>Category</h3>
                {canEditWorkRequest(detail) && !terminalRowStatus(detail.status) ? (
                  <input
                    className={FIELD}
                    value={detailCategoryDraft}
                    onChange={(e) => setDetailCategoryDraft(e.target.value)}
                    placeholder="e.g. HVAC, safety"
                  />
                ) : (
                  <p className="mt-1.5 text-sm text-pulse-navy">{detail.category?.trim() ? detail.category : "—"}</p>
                )}
              </div>
              <div>
                <h3 className={LABEL}>Asset</h3>
                <p className="mt-1.5 text-sm font-medium text-pulse-navy">{detail.asset_name ?? "—"}</p>
                <p className="text-xs text-pulse-muted">{detail.asset_tag ?? detail.tool_id ?? ""}</p>
              </div>
              <div>
                <h3 className={LABEL}>Location</h3>
                {canEditWorkRequest(detail) && !terminalRowStatus(detail.status) ? (
                  <select
                    className={FIELD}
                    value={detailZoneDraft}
                    onChange={(e) => setDetailZoneDraft(e.target.value)}
                  >
                    <option value="">None</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1.5 text-sm text-pulse-navy">{detail.location_name ?? "—"}</p>
                )}
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
                {canEditWorkRequest(detail) && !terminalRowStatus(detail.status) ? (
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

            {canEditWorkRequest(detail) && !terminalRowStatus(detail.status) && detailMetaDirty ? (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className={PRIMARY_BTN}
                  disabled={actionBusy}
                  onClick={() => void saveDetailMetaFields()}
                >
                  Save location &amp; details
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {detail.status === "pending_approval" && canApprove ? (
                <>
                  <button type="button" className={PRIMARY_BTN} disabled={actionBusy} onClick={() => void approveItem(detail.id)}>
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded-[10px] border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-800 shadow-sm hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/35 dark:bg-rose-950/40 dark:text-rose-100"
                    disabled={actionBusy}
                    onClick={() => void rejectItem(detail.id)}
                  >
                    Reject
                  </button>
                </>
              ) : null}
              {detail.status === "approved" && canEditWorkRequest(detail) ? (
                <span className="text-sm text-pulse-muted">Assign a worker to move this item to Assigned.</span>
              ) : null}
              {detail.status === "assigned" ? (
                <button type="button" className={PRIMARY_BTN} disabled={actionBusy} onClick={() => void startItem(detail.id)}>
                  Start
                </button>
              ) : null}
              {detail.status === "in_progress" ? (
                <button type="button" className={PRIMARY_BTN} disabled={actionBusy} onClick={() => void completeItem(detail.id)}>
                  Complete
                </button>
              ) : null}
            </div>

            <div>
              <h3 className={LABEL}>Activity</h3>
              <ul className="mt-2 space-y-2 border-l-2 border-slate-200 pl-4">
                {detail.activity.length === 0 ? (
                  <li className="text-sm text-pulse-muted">No activity yet.</li>
                ) : (
                  detail.activity.map((a) => {
                    const statusLine = activityStatusSummary(a.meta, a.action);
                    return (
                      <li key={a.id} className="text-sm">
                        <span className="font-semibold text-pulse-navy">{a.action.replace(/_/g, " ")}</span>
                        <span className="text-pulse-muted">
                          {" "}
                          · {a.performer_name ?? "—"} · {new Date(a.created_at).toLocaleString()}
                        </span>
                        {statusLine ? <p className="mt-1 text-xs text-pulse-muted">{statusLine}</p> : null}
                      </li>
                    );
                  })
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
        open={zonesEditorOpen}
        title="Facility locations"
        subtitle="Names appear in work request location lists. Who may edit this list is configured under Workers → Overview → Access policy."
        onClose={() => {
          setZonesEditorOpen(false);
          setNewZoneName("");
        }}
        wide
        labelledBy="wr-zones-title"
      >
        <p id="wr-zones-title" className="sr-only">
          Facility locations
        </p>
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 p-4 dark:border-ds-border dark:bg-ds-secondary/60">
            <label className={LABEL} htmlFor="wr-new-zone">
              Add location
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
              <input
                id="wr-new-zone"
                className={FIELD}
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="e.g. Building A — Floor 2"
              />
              <button
                type="button"
                className={PRIMARY_BTN}
                disabled={actionBusy || !newZoneName.trim()}
                onClick={() => void createZoneFromEditor()}
              >
                Add
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className={LABEL}>Existing locations</h3>
            {zones.length === 0 ? (
              <p className="text-sm text-pulse-muted">No locations yet. Add one above.</p>
            ) : (
              zones.map((z) => {
                const draft = zoneNameDrafts[z.id] ?? z.name;
                const dirty = draft.trim() !== z.name;
                return (
                  <div
                    key={z.id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200/90 bg-white p-3 sm:flex-row sm:items-end dark:border-ds-border dark:bg-ds-primary"
                  >
                    <div className="min-w-0 flex-1">
                      <label className={LABEL} htmlFor={`zone-${z.id}`}>
                        Name
                      </label>
                      <input
                        id={`zone-${z.id}`}
                        className={FIELD}
                        value={draft}
                        onChange={(e) =>
                          setZoneNameDrafts((prev) => ({ ...prev, [z.id]: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={PRIMARY_BTN}
                        disabled={actionBusy || !dirty || !draft.trim()}
                        onClick={() => void saveZoneName(z.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="rounded-[10px] border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-800 shadow-sm hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/40 dark:bg-ds-primary dark:text-rose-100"
                        disabled={actionBusy}
                        onClick={() => void deleteZoneFromEditor(z.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PulseDrawer>

      <PulseDrawer
        open={settingsOpen}
        title="Work request settings"
        subtitle="Statuses, priorities, SLA defaults, routing, and notification toggles"
        onClose={() => setSettingsOpen(false)}
        wide
        elevated
        placement="center"
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

      {assignModalForId ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <button
            type="button"
            className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
            aria-label="Dismiss"
            disabled={actionBusy}
            onClick={() => {
              if (!actionBusy) {
                setAssignModalForId(null);
                setAssignPickUserId("");
              }
            }}
          />
          <div
            className="relative w-full max-w-md rounded-xl border border-slate-200/90 bg-white p-5 shadow-xl dark:border-ds-border dark:bg-ds-primary"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wr-assign-title"
          >
            <h2 id="wr-assign-title" className="text-lg font-semibold text-pulse-navy dark:text-gray-100">
              Assign work request
            </h2>
            <p className="mt-1 text-sm text-pulse-muted">
              {(() => {
                const r = rows.find((x) => x.id === assignModalForId);
                return r ? (
                  <>
                    <span className="font-medium text-pulse-navy dark:text-gray-100">{workItemDisplayId(r)}</span>
                    {" — "}
                    {r.title}
                  </>
                ) : null;
              })()}
            </p>
            <label className="mt-4 block">
              <span className={LABEL}>Worker</span>
              <select
                className={FIELD}
                value={assignPickUserId}
                onChange={(e) => setAssignPickUserId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name?.trim() ? `${w.full_name} (${w.email})` : w.email}
                  </option>
                ))}
              </select>
            </label>
            {workers.length === 0 ? (
              <p className="mt-2 text-xs text-pulse-muted">No workers loaded. Check company context or refresh the page.</p>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-pulse-muted hover:text-pulse-navy dark:hover:text-gray-100"
                disabled={actionBusy}
                onClick={() => {
                  setAssignModalForId(null);
                  setAssignPickUserId("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={PRIMARY_BTN}
                disabled={actionBusy || !canSaveAssign}
                onClick={() =>
                  void (async () => {
                    if (!assignModalForId) return;
                    try {
                      const ok = await assignItem(assignModalForId, assignPickUserId || null);
                      if (ok) {
                        setAssignModalForId(null);
                        setAssignPickUserId("");
                      }
                    } catch {
                      /* keep modal open */
                    }
                  })()
                }
              >
                {actionBusy ? "Saving…" : "Save assignment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {closeModalForId ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <button
            type="button"
            className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
            aria-label="Dismiss"
            disabled={actionBusy}
            onClick={() => {
              if (!actionBusy) {
                setCloseModalForId(null);
                setCloseReasonDraft("");
              }
            }}
          />
          <div
            className="relative w-full max-w-md rounded-xl border border-slate-200/90 bg-white p-5 shadow-xl dark:border-ds-border dark:bg-ds-primary"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wr-close-title"
          >
            <h2 id="wr-close-title" className="text-lg font-semibold text-pulse-navy dark:text-gray-100">
              Close work request
            </h2>
            <p className="mt-1 text-sm text-pulse-muted">
              This will mark the request as cancelled. Your reason is saved on the activity timeline.
            </p>
            <label className="mt-4 block">
              <span className={LABEL}>Reason for closing</span>
              <textarea
                className={`${FIELD} min-h-[100px]`}
                value={closeReasonDraft}
                onChange={(e) => setCloseReasonDraft(e.target.value)}
                placeholder="e.g. Duplicate entry, resolved elsewhere, no longer needed…"
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-pulse-muted hover:text-pulse-navy dark:hover:text-gray-100"
                disabled={actionBusy}
                onClick={() => {
                  setCloseModalForId(null);
                  setCloseReasonDraft("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={PRIMARY_BTN}
                disabled={actionBusy || !closeReasonDraft.trim()}
                onClick={() => void confirmCloseWorkRequest()}
              >
                {actionBusy ? "Closing…" : "Close request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {holdModalForId ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <button
            type="button"
            className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
            aria-label="Dismiss"
            disabled={actionBusy}
            onClick={() => {
              if (!actionBusy) {
                setHoldModalForId(null);
                setHoldNoteDraft("");
                setHoldReasonKey(WORK_REQUEST_HOLD_REASONS[0]!.id);
              }
            }}
          />
          <div
            className="relative w-full max-w-md rounded-xl border border-slate-200/90 bg-white p-5 shadow-xl dark:border-ds-border dark:bg-ds-primary"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wr-hold-title"
          >
            <h2 id="wr-hold-title" className="text-lg font-semibold text-pulse-navy dark:text-gray-100">
              Place on hold
            </h2>
            <p className="mt-1 text-sm text-pulse-muted">
              Choose a reason. Optional notes are stored with the activity record.
            </p>
            <label className="mt-4 block">
              <span className={LABEL}>Hold reason</span>
              <select
                className={FIELD}
                value={holdReasonKey}
                onChange={(e) => setHoldReasonKey(e.target.value)}
              >
                {WORK_REQUEST_HOLD_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block">
              <span className={LABEL}>Additional detail (optional)</span>
              <textarea
                className={`${FIELD} min-h-[80px]`}
                value={holdNoteDraft}
                onChange={(e) => setHoldNoteDraft(e.target.value)}
                placeholder="Access hours, part numbers, vendor name…"
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-pulse-muted hover:text-pulse-navy dark:hover:text-gray-100"
                disabled={actionBusy}
                onClick={() => {
                  setHoldModalForId(null);
                  setHoldNoteDraft("");
                  setHoldReasonKey(WORK_REQUEST_HOLD_REASONS[0]!.id);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={PRIMARY_BTN}
                disabled={actionBusy}
                onClick={() => void confirmHoldWorkRequest()}
              >
                {actionBusy ? "Saving…" : "Place on hold"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </PageBody>
    </div>
  );
}
