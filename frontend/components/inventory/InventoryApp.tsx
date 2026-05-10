"use client";

/**
 * Inventory management: assets, parts, consumables — filters, KPIs, table, detail drawer,
 * movements / WR usage, settings (categories, thresholds, locations, alerts).
 * Matches Work Requests / Workers industrial shell styling.
 */
import {
  AlertTriangle,
  ArrowRightLeft,
  Box,
  ChevronDown,
  ClipboardList,
  Download,
  HardHat,
  Loader2,
  MapPin,
  MoreVertical,
  Package,
  Search,
  Settings,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/lib/api";
import type {
  InventoryDetail,
  InventoryModuleSettings,
  InventoryRow,
  InventorySummary,
} from "@/lib/inventoryService";
import {
  createInventoryItem,
  fetchInventoryDetail,
  fetchInventoryList,
  fetchInventorySettings,
  patchInventoryItem,
  patchInventorySettings,
  postInventoryAssign,
  postInventoryMove,
  postInventoryUse,
} from "@/lib/inventoryService";
import { canAccessCompanyConfiguration, managerOrAbove } from "@/lib/pulse-roles";
import { readSession } from "@/lib/pulse-session";
import { fetchWorkRequestList } from "@/lib/workRequestsService";
import { InventoryContractorsPanel } from "@/components/inventory/InventoryContractorsPanel";
import { InventoryVendorsPanel } from "@/components/inventory/InventoryVendorsPanel";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type CompanyOption = { id: string; name: string };
type ZoneOpt = { id: string; name: string };
type AssetOpt = { id: string; name: string; tag_id?: string | null };
type WorkerOpt = { id: string; email: string; full_name: string | null };

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:placeholder:text-gray-500";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

const DEFAULT_SETTINGS: Required<
  Pick<
    InventoryModuleSettings,
    "categories" | "threshold_defaults" | "locations" | "assignment_rules" | "alerts" | "status_rules"
  >
> = {
  categories: ["Tool", "Part", "Consumable", "Fasteners", "Electrical"],
  status_rules: {
    in_stock: true,
    assigned: true,
    low_stock: true,
    missing: true,
    maintenance: true,
  },
  threshold_defaults: { default_min: 5 },
  locations: [],
  assignment_rules: { checkout_required: true },
  alerts: { low_stock: true, missing: true },
};

/** Controlled textarea lines: trim each line but keep empties so Enter / new rows are not stripped immediately. */
function draftLinesFromTextarea(value: string): string[] {
  return value.split("\n").map((line) => line.trim());
}

function normalizeNonEmptyLines(lines: string[]): string[] {
  return lines.map((x) => x.trim()).filter((x) => x.length > 0);
}

const SETTINGS_TABS = [
  "Categories",
  "Status rules",
  "Thresholds",
  "Alerts",
] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUnitCost(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function statusBadge(status: string): string {
  switch (status) {
    case "assigned":
      return "bg-[#ebf8ff] text-[#3182ce] ring-1 ring-blue-200/80 dark:bg-blue-600 dark:text-white dark:ring-blue-500/40";
    case "low_stock":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-600 dark:text-white dark:ring-amber-400/40";
    case "missing":
      return "bg-[#fff5eb] text-[#c05621] ring-1 ring-orange-200/80 dark:bg-orange-600 dark:text-white dark:ring-orange-400/40";
    case "maintenance":
      return "bg-violet-50 text-violet-900 ring-1 ring-violet-200/75 dark:bg-violet-600 dark:text-white dark:ring-violet-400/45";
    case "in_stock":
    default:
      return "bg-sky-50/90 text-[#2B4C7E] ring-1 ring-sky-200/70 dark:bg-emerald-600 dark:text-white dark:ring-emerald-500/40";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function conditionLabel(c: string): string {
  if (c === "needs_maintenance") return "Needs maintenance";
  if (c === "critical") return "Critical";
  return "Good";
}

function conditionBadge(c: string): string {
  if (c === "critical") return "bg-rose-50 text-rose-800 ring-1 ring-rose-200/75 dark:bg-red-600 dark:text-white dark:ring-red-500/45";
  if (c === "needs_maintenance") return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/75 dark:bg-amber-600 dark:text-white dark:ring-amber-400/40";
  return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70 dark:bg-emerald-600 dark:text-white dark:ring-emerald-500/40";
}

function typeIcon(t: string) {
  if (t === "tool") return Wrench;
  if (t === "consumable") return Box;
  return Package;
}

const QTY_STEP_BTN =
  "inline-flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-md border border-slate-200/90 bg-white text-sm font-medium text-pulse-navy shadow-sm outline-none transition-[transform,colors] hover:bg-ds-interactive-hover active:bg-ds-interactive-active focus-visible:ring-2 focus-visible:ring-sky-400/35 active:scale-95 disabled:pointer-events-none disabled:opacity-40 dark:border-ds-border dark:bg-ds-secondary dark:hover:bg-ds-interactive-hover dark:active:bg-ds-interactive-active";

function InventoryTableQtyCell(props: {
  row: InventoryRow;
  pending: boolean;
  onUpdateQuantity: (id: string, newQuantity: number) => void;
}) {
  const { row, pending, onUpdateQuantity } = props;
  if (row.item_type === "tool") {
    return <span className="whitespace-nowrap font-medium text-pulse-navy">1 (tracked)</span>;
  }

  const onQtyKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      onUpdateQuantity(row.id, Math.max(0, row.quantity - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      onUpdateQuantity(row.id, row.quantity + 1);
    }
  };

  return (
    <div
      className="flex items-center gap-2 whitespace-nowrap"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={onQtyKeyDown}
      tabIndex={0}
      role="group"
      aria-label={`Adjust quantity for ${row.name}`}
    >
      <button
        type="button"
        onClick={() => onUpdateQuantity(row.id, Math.max(0, row.quantity - 1))}
        disabled={pending || row.quantity <= 0}
        className={QTY_STEP_BTN}
        aria-label="Decrease quantity"
      >
        -
      </button>
      <span className="min-w-[2.25rem] text-center tabular-nums font-medium text-pulse-navy">{row.quantity}</span>
      <button
        type="button"
        onClick={() => onUpdateQuantity(row.id, row.quantity + 1)}
        disabled={pending}
        className={QTY_STEP_BTN}
        aria-label="Increase quantity"
      >
        +
      </button>
      <span className="max-w-[4.5rem] truncate text-xs text-pulse-muted" title={row.unit}>
        {row.unit}
      </span>
    </div>
  );
}

export function InventoryApp() {
  const session = readSession();
  const canConfigureOrg = canAccessCompanyConfiguration(session);
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const sessionCompanyId = session?.company_id ?? null;
  const canManage = managerOrAbove(session);

  const [companyPick, setCompanyPick] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const effectiveCompanyId = isSystemAdmin ? companyPick : sessionCompanyId;
  const dataEnabled = Boolean(effectiveCompanyId) && canManage;
  const apiCompany = isSystemAdmin ? effectiveCompanyId : null;

  const [inventoryTab, setInventoryTab] = useState<"items" | "vendors" | "contractors">("items");

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const [zones, setZones] = useState<ZoneOpt[]>([]);
  const [assets, setAssets] = useState<AssetOpt[]>([]);
  const [workers, setWorkers] = useState<WorkerOpt[]>([]);
  const [settingsBaseline, setSettingsBaseline] = useState<InventoryModuleSettings>({});

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<InventorySummary | null>(null);

  const mergedSettings = useMemo(() => {
    const s = settingsBaseline;
    return {
      categories: [...(s.categories?.length ? s.categories : DEFAULT_SETTINGS.categories)],
      status_rules: { ...DEFAULT_SETTINGS.status_rules, ...s.status_rules },
      threshold_defaults: { ...DEFAULT_SETTINGS.threshold_defaults, ...s.threshold_defaults },
      locations: [...(s.locations?.length ? s.locations : DEFAULT_SETTINGS.locations)],
      assignment_rules: { ...DEFAULT_SETTINGS.assignment_rules, ...s.assignment_rules },
      alerts: { ...DEFAULT_SETTINGS.alerts, ...s.alerts },
    };
  }, [settingsBaseline]);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [qtyPending, setQtyPending] = useState<Record<string, boolean>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("Categories");
  const [settingsDraft, setSettingsDraft] = useState(mergedSettings);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InventoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [movementOpen, setMovementOpen] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<"create" | "edit">("create");
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editFormLoading, setEditFormLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    item_type: "part",
    category: "",
    quantity: "0",
    unit: "count",
    low_stock_threshold: String(DEFAULT_SETTINGS.threshold_defaults.default_min ?? 5),
    zone_id: "",
    assigned_user_id: "",
    linked_tool_id: "",
    condition: "good",
    unit_cost: "",
    vendor: "",
    reorder_flag: false,
  });

  const [assignUserId, setAssignUserId] = useState("");
  const [moveZoneId, setMoveZoneId] = useState("");
  const [useWrId, setUseWrId] = useState("");
  const [useQty, setUseQty] = useState("1");
  const [wrOptions, setWrOptions] = useState<{ id: string; title: string }[]>([]);

  const [detailPanel, setDetailPanel] = useState<"none" | "assign" | "move" | "use">("none");

  useEffect(() => {
    if (settingsOpen) return;
    setSettingsDraft(mergedSettings);
  }, [mergedSettings, settingsOpen]);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

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
      setWorkers([]);
      return;
    }
    void (async () => {
      try {
        const [z, a, w] = await Promise.all([
          apiFetch<ZoneOpt[]>(`/api/v1/pulse/zones`),
          apiFetch<AssetOpt[]>(`/api/v1/pulse/assets`),
          apiFetch<WorkerOpt[]>(`/api/v1/pulse/workers`),
        ]);
        setZones(z);
        setAssets(a);
        setWorkers(w);
      } catch {
        setZones([]);
        setAssets([]);
        setWorkers([]);
      }
    })();
  }, [dataEnabled, session?.access_token]);

  const loadSettings = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const r = await fetchInventorySettings(apiCompany);
      setSettingsBaseline(r.settings ?? {});
    } catch {
      setSettingsBaseline({});
    }
  }, [apiCompany, effectiveCompanyId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const loadList = useCallback(async () => {
    if (!dataEnabled || !effectiveCompanyId) return;
    setListLoading(true);
    setListError(null);
    try {
      const date_from = dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined;
      const date_to = dateTo ? `${dateTo}T23:59:59.999Z` : undefined;
      const res = await fetchInventoryList({
        companyId: apiCompany,
        q: qDebounced || undefined,
        status: statusFilter || undefined,
        item_type: typeFilter || undefined,
        category: categoryFilter || undefined,
        zone_id: zoneFilter || undefined,
        date_from,
        date_to,
        limit: pageSize,
        offset: page * pageSize,
      });
      setRows(res.items);
      setTotal(res.total);
      setSummary(res.summary);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
      setSummary(null);
    } finally {
      setListLoading(false);
    }
  }, [
    dataEnabled,
    effectiveCompanyId,
    apiCompany,
    qDebounced,
    statusFilter,
    typeFilter,
    categoryFilter,
    zoneFilter,
    dateFrom,
    dateTo,
    page,
  ]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async () => {
    if (!detailId || !effectiveCompanyId) return;
    setDetailLoading(true);
    try {
      const d = await fetchInventoryDetail(apiCompany, detailId);
      setDetail(d);
      setAssignUserId(d.assigned_user_id ?? "");
      setMoveZoneId(d.zone_id ?? "");
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [detailId, effectiveCompanyId, apiCompany]);

  useEffect(() => {
    if (detailId) void loadDetail();
    else setDetail(null);
  }, [detailId, loadDetail]);

  useEffect(() => {
    if (detailId) setMovementOpen(true);
  }, [detailId]);

  useEffect(() => {
    if (!detailId || !dataEnabled) return;
    void (async () => {
      try {
        const wr = await fetchWorkRequestList({
          companyId: apiCompany,
          status: "open",
          limit: 40,
          offset: 0,
        });
        const wr2 = await fetchWorkRequestList({
          companyId: apiCompany,
          status: "in_progress",
          limit: 40,
          offset: 0,
        });
        const map = new Map<string, string>();
        [...wr.items, ...wr2.items].forEach((x) => map.set(x.id, x.title));
        setWrOptions([...map.entries()].map(([id, title]) => ({ id, title })));
      } catch {
        setWrOptions([]);
      }
    })();
  }, [detailId, dataEnabled, apiCompany]);

  useEffect(() => {
    if (!settingsOpen || !effectiveCompanyId) return;
    setSettingsLoading(true);
    void (async () => {
      try {
        const r = await fetchInventorySettings(apiCompany);
        const base = r.settings ?? {};
        setSettingsBaseline(base);
        const merged = {
          categories: [...(base.categories?.length ? base.categories : DEFAULT_SETTINGS.categories)],
          status_rules: { ...DEFAULT_SETTINGS.status_rules, ...base.status_rules },
          threshold_defaults: { ...DEFAULT_SETTINGS.threshold_defaults, ...base.threshold_defaults },
          locations: [...(base.locations?.length ? base.locations : DEFAULT_SETTINGS.locations)],
          assignment_rules: { ...DEFAULT_SETTINGS.assignment_rules, ...base.assignment_rules },
          alerts: { ...DEFAULT_SETTINGS.alerts, ...base.alerts },
        };
        setSettingsDraft(merged);
      } catch {
        setSettingsDraft({
          categories: [...DEFAULT_SETTINGS.categories],
          status_rules: { ...DEFAULT_SETTINGS.status_rules },
          threshold_defaults: { ...DEFAULT_SETTINGS.threshold_defaults },
          locations: [...DEFAULT_SETTINGS.locations],
          assignment_rules: { ...DEFAULT_SETTINGS.assignment_rules },
          alerts: { ...DEFAULT_SETTINGS.alerts },
        });
      } finally {
        setSettingsLoading(false);
      }
    })();
  }, [settingsOpen, effectiveCompanyId, apiCompany]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);

  function clearFilters() {
    setQ("");
    setStatusFilter("");
    setTypeFilter("");
    setCategoryFilter("");
    setZoneFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  function openCreate() {
    setEditMode("create");
    setEditTargetId(null);
    setForm({
      name: "",
      sku: "",
      item_type: "part",
      category: "",
      quantity: "0",
      unit: "count",
      low_stock_threshold: String(mergedSettings.threshold_defaults.default_min ?? 5),
      zone_id: "",
      assigned_user_id: "",
      linked_tool_id: "",
      condition: "good",
      unit_cost: "",
      vendor: "",
      reorder_flag: false,
    });
    setEditOpen(true);
  }

  function openEdit(row: InventoryRow) {
    setEditMode("edit");
    setEditTargetId(row.id);
    setForm({
      name: row.name,
      sku: row.sku,
      item_type: row.item_type,
      category: row.category ?? "",
      quantity: String(row.quantity),
      unit: row.unit,
      low_stock_threshold: String(row.low_stock_threshold),
      zone_id: row.zone_id ?? "",
      assigned_user_id: row.assigned_user_id ?? "",
      linked_tool_id: row.linked_tool_id ?? "",
      condition: row.condition,
      unit_cost: row.unit_cost != null ? String(row.unit_cost) : "",
      vendor: row.vendor ?? "",
      reorder_flag: row.reorder_flag,
    });
    setEditOpen(true);
  }

  function openEditFromDetail(d: InventoryDetail) {
    setEditMode("edit");
    setEditTargetId(d.id);
    setForm({
      name: d.name,
      sku: d.sku,
      item_type: d.item_type,
      category: d.category ?? "",
      quantity: String(d.quantity),
      unit: d.unit,
      low_stock_threshold: String(d.low_stock_threshold),
      zone_id: d.zone_id ?? "",
      assigned_user_id: d.assigned_user_id ?? "",
      linked_tool_id: d.linked_tool_id ?? "",
      condition: d.condition,
      unit_cost: d.unit_cost != null ? String(d.unit_cost) : "",
      vendor: d.vendor ?? "",
      reorder_flag: d.reorder_flag,
    });
    setEditOpen(true);
  }

  useEffect(() => {
    if (!editOpen || editMode !== "edit" || !editTargetId || !effectiveCompanyId) return;
    setEditFormLoading(true);
    void (async () => {
      try {
        const d = await fetchInventoryDetail(apiCompany, editTargetId);
        setForm({
          name: d.name,
          sku: d.sku,
          item_type: d.item_type,
          category: d.category ?? "",
          quantity: String(d.quantity),
          unit: d.unit,
          low_stock_threshold: String(d.low_stock_threshold),
          zone_id: d.zone_id ?? "",
          assigned_user_id: d.assigned_user_id ?? "",
          linked_tool_id: d.linked_tool_id ?? "",
          condition: d.condition,
          unit_cost: d.unit_cost != null ? String(d.unit_cost) : "",
          vendor: d.vendor ?? "",
          reorder_flag: d.reorder_flag,
        });
      } catch {
        /* keep table row snapshot */
      } finally {
        setEditFormLoading(false);
      }
    })();
  }, [editOpen, editMode, editTargetId, effectiveCompanyId, apiCompany]);

  async function submitForm() {
    if (!effectiveCompanyId || !form.name.trim()) return;
    setActionBusy(true);
    try {
      const unit_cost =
        form.unit_cost.trim() === "" ? null : Number.parseFloat(form.unit_cost);
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        item_type: form.item_type,
        category: form.category.trim() || null,
        quantity: Number.parseFloat(form.quantity) || 0,
        unit: form.unit.trim() || "count",
        low_stock_threshold: Number.parseFloat(form.low_stock_threshold) || 0,
        zone_id: form.zone_id || null,
        assigned_user_id: form.assigned_user_id || null,
        linked_tool_id: form.linked_tool_id || null,
        condition: form.condition,
        unit_cost: unit_cost != null && !Number.isNaN(unit_cost) ? unit_cost : null,
        vendor: form.vendor.trim() || null,
        reorder_flag: form.reorder_flag,
      };
      if (editMode === "create") {
        const d = await createInventoryItem(apiCompany, payload);
        setEditOpen(false);
        setEditTargetId(null);
        setDetailId(d.id);
      } else if (editTargetId) {
        const eid = editTargetId;
        await patchInventoryItem(apiCompany, eid, {
          ...payload,
          sku: payload.sku ?? undefined,
        });
        setEditOpen(false);
        setEditTargetId(null);
        if (detailId === eid) await loadDetail();
      }
      await loadList();
    } finally {
      setActionBusy(false);
    }
  }

  async function saveSettings() {
    if (!effectiveCompanyId) return;
    setActionBusy(true);
    try {
      await patchInventorySettings(apiCompany, {
        categories: normalizeNonEmptyLines(settingsDraft.categories),
        status_rules: settingsDraft.status_rules,
        threshold_defaults: settingsDraft.threshold_defaults,
        alerts: settingsDraft.alerts,
      });
      setSettingsOpen(false);
      await loadSettings();
    } finally {
      setActionBusy(false);
    }
  }

  async function runAssignFromDetail() {
    if (!detailId) return;
    setActionBusy(true);
    try {
      await postInventoryAssign(apiCompany, detailId, assignUserId || null);
      await loadDetail();
      await loadList();
      setDetailPanel("none");
    } finally {
      setActionBusy(false);
    }
  }

  async function runMoveFromDetail() {
    if (!detailId) return;
    setActionBusy(true);
    try {
      await postInventoryMove(apiCompany, detailId, moveZoneId || null);
      await loadDetail();
      await loadList();
      setDetailPanel("none");
    } finally {
      setActionBusy(false);
    }
  }

  async function runUseFromDetail() {
    if (!detailId || !useWrId) return;
    const qn = Number.parseFloat(useQty);
    if (Number.isNaN(qn) || qn <= 0) return;
    setActionBusy(true);
    try {
      await postInventoryUse(apiCompany, detailId, { work_request_id: useWrId, quantity: qn });
      setUseQty("1");
      setUseWrId("");
      await loadDetail();
      await loadList();
      setDetailPanel("none");
    } finally {
      setActionBusy(false);
    }
  }

  async function quickPatch(id: string, body: Record<string, unknown>) {
    setActionBusy(true);
    try {
      await patchInventoryItem(apiCompany, id, body);
      setMenuFor(null);
      await loadList();
      if (detailId === id) await loadDetail();
    } finally {
      setActionBusy(false);
    }
  }

  const updateQuantity = useCallback(
    async (id: string, newQuantity: number) => {
      if (!effectiveCompanyId) return;
      const clamped = Math.max(0, newQuantity);

      let snapshotRow: InventoryRow | null = null;
      let snapshotDetail: InventoryDetail | null = null;

      setRows((rs) => {
        const cur = rs.find((r) => r.id === id);
        if (cur) snapshotRow = { ...cur };
        return rs.map((r) => (r.id === id ? { ...r, quantity: clamped } : r));
      });

      setDetail((d) => {
        if (d?.id === id) {
          snapshotDetail = d;
          return { ...d, quantity: clamped };
        }
        return d;
      });

      setQtyPending((m) => ({ ...m, [id]: true }));
      try {
        const updated = await patchInventoryItem(apiCompany, id, { quantity: clamped });
        setRows((rs) =>
          rs.map((r) =>
            r.id === id
              ? {
                  ...r,
                  quantity: updated.quantity,
                  inv_status: updated.inv_status,
                  reorder_flag: updated.reorder_flag,
                  last_movement_at: updated.last_movement_at,
                }
              : r,
          ),
        );
        setDetail((d) => (d?.id === id ? updated : d));
      } catch {
        if (snapshotRow) {
          setRows((rs) => rs.map((r) => (r.id === id ? snapshotRow! : r)));
        }
        if (snapshotDetail) {
          setDetail(snapshotDetail);
        }
      } finally {
        setQtyPending((m) => {
          const next = { ...m };
          delete next[id];
          return next;
        });
      }
    },
    [apiCompany, effectiveCompanyId],
  );

  function exportCsv() {
    const headers = [
      "SKU",
      "Name",
      "Type",
      "Category",
      "Status",
      "Qty",
      "Unit",
      "Vendor",
      "Unit cost",
      "Assignee",
      "Location",
      "Condition",
    ];
    const lines = rows.map((r) =>
      [
        r.sku,
        r.name.replace(/"/g, '""'),
        r.item_type,
        r.category ?? "",
        r.inv_status,
        String(r.quantity),
        r.unit,
        r.vendor ?? "",
        r.unit_cost != null ? String(r.unit_cost) : "",
        r.assignee_name ?? "",
        r.location_name ?? "",
        r.condition,
      ]
        .map((c) => `"${c}"`)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pulse-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!canManage) {
    return (
      <p className="text-sm text-pulse-muted">Inventory is available to managers and administrators.</p>
    );
  }

  const sum = summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={
          inventoryTab === "items"
            ? "Tools, spare parts, and consumables — locations, assignments, and work request usage."
            : inventoryTab === "vendors"
              ? "Vendor directory — contacts, account references, specialties, and addresses. Filter any column in the grid."
              : "Contractor directory — contacts, account references, trade or specialty, and addresses. Filter any column in the grid."
        }
        icon={
          inventoryTab === "items" ? Package : inventoryTab === "vendors" ? Truck : HardHat
        }
        actions={
          <>
            {inventoryTab === "items" ? (
              <>
                <button
                  type="button"
                  className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50")}
                  onClick={() => exportCsv()}
                  disabled={rows.length === 0}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Export CSV
                </button>
                {canConfigureOrg ? (
                  <button
                    type="button"
                    className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex items-center gap-2 px-4 py-2.5")}
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" aria-hidden />
                    Settings
                  </button>
                ) : null}
                <button type="button" className={PRIMARY_BTN} onClick={() => openCreate()} disabled={!dataEnabled}>
                  + Register item
                </button>
              </>
            ) : (
              <>
                {canConfigureOrg ? (
                  <button
                    type="button"
                    className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex items-center gap-2 px-4 py-2.5")}
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" aria-hidden />
                    Settings
                  </button>
                ) : null}
              </>
            )}
          </>
        }
      />

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
          {isSystemAdmin ? "Select a company to load inventory." : "Unable to resolve organization."}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 rounded-lg border border-pulse-border bg-white p-1 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
            <button
              type="button"
              onClick={() => setInventoryTab("items")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                inventoryTab === "items"
                  ? "bg-ds-accent text-ds-accent-foreground shadow-sm"
                  : "text-pulse-muted hover:bg-ds-interactive-hover dark:hover:bg-ds-interactive-hover"
              }`}
            >
              Items
            </button>
            <button
              type="button"
              onClick={() => setInventoryTab("vendors")}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                inventoryTab === "vendors"
                  ? "bg-ds-accent text-ds-accent-foreground shadow-sm"
                  : "text-pulse-muted hover:bg-ds-interactive-hover dark:hover:bg-ds-interactive-hover"
              }`}
            >
              <Truck className="h-4 w-4" aria-hidden />
              Vendors
            </button>
            <button
              type="button"
              onClick={() => setInventoryTab("contractors")}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                inventoryTab === "contractors"
                  ? "bg-ds-accent text-ds-accent-foreground shadow-sm"
                  : "text-pulse-muted hover:bg-ds-interactive-hover dark:hover:bg-ds-interactive-hover"
              }`}
            >
              <HardHat className="h-4 w-4" aria-hidden />
              Contractors
            </button>
          </div>

          {inventoryTab === "vendors" ? (
            <InventoryVendorsPanel apiCompany={apiCompany} />
          ) : null}

          {inventoryTab === "contractors" ? (
            <InventoryContractorsPanel apiCompany={apiCompany} />
          ) : null}

          {inventoryTab === "items" && sum ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
              {[
                {
                  label: "Total items",
                  value: sum.total_items,
                  icon: Package,
                  sub: null as string | null,
                  tone: "text-ds-accent",
                },
                {
                  label: "In stock",
                  value: sum.in_stock,
                  icon: Box,
                  sub: null,
                  tone: "text-[#3182ce]",
                },
                {
                  label: "Low stock",
                  value: sum.low_stock,
                  icon: AlertTriangle,
                  sub: sum.low_stock > 0 ? "Review thresholds" : null,
                  tone: "text-amber-800",
                  alert: sum.low_stock > 0,
                },
                ...([0, 1, 2] as const).map((i) => {
                  const row = sum.most_used?.[i];
                  return {
                    label: `Top ${i + 1} by uses`,
                    value: row ? row.usage_count.toLocaleString() : "—",
                    icon: TrendingUp,
                    sub: row
                      ? `${row.name}${row.sku ? ` · ${row.sku}` : ""}`
                      : "No logged usage yet",
                    tone: "text-emerald-800 dark:text-emerald-400/90",
                  };
                }),
                {
                  label: "Inventory value",
                  value: sum.estimated_value != null ? `$${sum.estimated_value.toLocaleString()}` : "—",
                  icon: ClipboardList,
                  sub: "Qty × unit cost",
                  tone: "text-slate-800",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className={`rounded-md border bg-white p-4 shadow-sm ring-1 dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)] ${
                    "alert" in card && card.alert
                      ? "border-amber-200 ring-amber-100/90 dark:border-amber-500/35 dark:ring-amber-500/20"
                      : "border-pulse-border ring-slate-100/80 dark:border-ds-border dark:ring-white/[0.06]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-pulse-muted">{card.label}</p>
                    <card.icon className={`h-5 w-5 shrink-0 opacity-80 ${card.tone}`} aria-hidden />
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-pulse-navy dark:text-gray-100">{card.value}</p>
                  {card.sub ? (
                    <p
                      className={`mt-0.5 text-xs font-semibold ${
                        "alert" in card && card.alert ? "text-rose-600" : "text-pulse-muted"
                      }`}
                    >
                      {card.sub}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {inventoryTab === "items" ? (
          <>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { id: "", label: "All" },
              { id: "in_stock", label: "In stock" },
              { id: "assigned", label: "Assigned" },
              { id: "low_stock", label: "Low stock" },
            ].map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setStatusFilter(t.id);
                  setPage(0);
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  statusFilter === t.id
                    ? "bg-ds-accent text-ds-accent-foreground shadow-sm"
                    : "bg-slate-100 text-pulse-navy hover:bg-ds-interactive-hover-strong dark:bg-ds-secondary dark:text-white dark:hover:bg-ds-interactive-hover"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <div className="relative min-w-[14rem]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted" />
                <input
                  type="search"
                  placeholder="Search inventory, tools, parts…"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(0);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-pulse-navy placeholder:text-slate-400 outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
                value={typeFilter ? `type:${typeFilter}` : categoryFilter ? `cat:${categoryFilter}` : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    setTypeFilter("");
                    setCategoryFilter("");
                  } else if (v.startsWith("type:")) {
                    setTypeFilter(v.slice("type:".length));
                    setCategoryFilter("");
                  } else if (v.startsWith("cat:")) {
                    setCategoryFilter(v.slice("cat:".length));
                    setTypeFilter("");
                  }
                  setPage(0);
                }}
              >
                <option value="">Type / category</option>
                <optgroup label="Type">
                  <option value="type:tool">Tool</option>
                  <option value="type:part">Part</option>
                  <option value="type:consumable">Consumable</option>
                </optgroup>
                <optgroup label="Category">
                  {mergedSettings.categories.map((c) => (
                    <option key={c} value={`cat:${c}`}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              </select>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
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
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
              />
            </div>
            <button type="button" className="text-sm font-semibold text-[#2B4C7E] hover:underline" onClick={clearFilters}>
              Clear filters
            </button>
          </div>

          <div className="app-data-shell mt-4">
            {listLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-pulse-muted">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Loading inventory…
              </div>
            ) : listError ? (
              <p className="p-6 text-sm text-rose-600">{listError}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1240px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="app-table-head-row border-pulse-border">
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Category / type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Quantity</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Cost</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Last movement</th>
                      <th className="px-4 py-3">Condition</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const Icon = typeIcon(row.item_type);
                      return (
                        <tr
                          key={row.id}
                          className="ds-table-row-hover cursor-pointer border-b border-slate-100 last:border-0 hover:bg-ds-interactive-hover dark:border-ds-border"
                          onClick={() => {
                            setDetailPanel("none");
                            setDetailId(row.id);
                          }}
                        >
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#ebf8ff] text-[#2B4C7E] dark:bg-[#1e3a5f] dark:text-sky-300">
                                <Icon className="h-4 w-4" aria-hidden />
                              </span>
                              <div>
                                <p className="font-semibold text-pulse-navy">{row.name}</p>
                                <p className="text-xs text-pulse-muted">{row.sku}</p>
                                {row.linked_asset_name ? (
                                  <p className="mt-0.5 text-xs text-[#2B4C7E]">
                                    Linked: {row.linked_asset_name}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-pulse-navy">
                            <span className="capitalize">{row.item_type}</span>
                            {row.category ? (
                              <>
                                <br />
                                <span className="text-xs text-pulse-muted">{row.category}</span>
                              </>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${statusBadge(
                                row.inv_status,
                              )}`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
                              {statusLabel(row.inv_status)}
                            </span>
                            {row.reorder_flag ? (
                              <span className="mt-1 block text-[10px] font-bold uppercase text-amber-800">
                                Reorder flagged
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-top font-medium text-pulse-navy">
                            <InventoryTableQtyCell
                              row={row}
                              pending={Boolean(qtyPending[row.id])}
                              onUpdateQuantity={updateQuantity}
                            />
                          </td>
                          <td className="max-w-[12rem] px-4 py-3 align-top text-pulse-navy">
                            <span className="line-clamp-2" title={row.vendor ?? undefined}>
                              {row.vendor?.trim() ? row.vendor : "—"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top tabular-nums text-pulse-navy">
                            {formatUnitCost(row.unit_cost)}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span className="inline-flex items-center gap-1 text-pulse-navy">
                              <MapPin className="h-3.5 w-3.5 text-[#3182ce]" aria-hidden />
                              {row.location_name ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top text-xs text-pulse-muted">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1">
                                <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
                                {formatTs(row.last_movement_at)}
                              </span>
                              {row.last_used_at ? (
                                <span>Used: {formatTs(row.last_used_at)}</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${conditionBadge(
                                row.condition,
                              )}`}
                            >
                              {conditionLabel(row.condition)}
                            </span>
                          </td>
                          <td className="relative px-4 py-3 text-right align-top" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-pulse-muted hover:bg-ds-interactive-hover-strong hover:text-pulse-navy"
                              aria-label="Actions"
                              onClick={() => setMenuFor(menuFor === row.id ? null : row.id)}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {menuFor === row.id ? (
                              <div className="absolute right-3 z-10 mt-1 w-52 rounded-md border border-slate-200 bg-white py-1 text-left shadow-lg dark:border-ds-border dark:bg-ds-elevated">
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-ds-interactive-hover"
                                  onClick={() => {
                                    setMenuFor(null);
                                    openEdit(row);
                                  }}
                                >
                                  Edit item
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-ds-interactive-hover"
                                  onClick={() => {
                                    setMenuFor(null);
                                    setDetailId(row.id);
                                    setDetailPanel("assign");
                                  }}
                                >
                                  Assign / return
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-ds-interactive-hover"
                                  onClick={() => quickPatch(row.id, { reorder_flag: !row.reorder_flag })}
                                >
                                  {row.reorder_flag ? "Clear reorder flag" : "Flag for reorder"}
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-ds-interactive-hover"
                                  onClick={() => quickPatch(row.id, { inv_status: "missing" })}
                                >
                                  Mark missing
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-ds-interactive-hover"
                                  onClick={() => quickPatch(row.id, { inv_status: "maintenance" })}
                                >
                                  Send to maintenance
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-ds-interactive-hover"
                                  onClick={() => quickPatch(row.id, { inv_status: "in_stock" })}
                                >
                                  Mark in stock
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
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-pulse-muted">
              Showing {start}–{end} of {total} items
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-pulse-navy disabled:opacity-40 dark:border-ds-border dark:bg-ds-elevated dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <span className="text-sm text-pulse-muted">
                Page {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-pulse-navy disabled:opacity-40 dark:border-ds-border dark:bg-ds-elevated dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
          </>
          ) : null}
        </>
      )}

      <PulseDrawer
        open={Boolean(detailId)}
        wide
        title={detail?.name ?? "Inventory item"}
        subtitle={detail ? `${detail.sku} · ${detail.item_type}` : undefined}
        onClose={() => {
          setDetailId(null);
          setDetailPanel("none");
        }}
        footer={
          detail ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={PRIMARY_BTN} onClick={() => detail && openEditFromDetail(detail)}>
                Edit
              </button>
              <button
                type="button"
                className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-pulse-navy hover:bg-ds-interactive-hover dark:border-ds-border dark:bg-ds-elevated dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                onClick={() => setDetailPanel(detailPanel === "assign" ? "none" : "assign")}
              >
                Assign
              </button>
              <button
                type="button"
                className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-pulse-navy hover:bg-ds-interactive-hover dark:border-ds-border dark:bg-ds-elevated dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                onClick={() => setDetailPanel(detailPanel === "move" ? "none" : "move")}
              >
                Move
              </button>
              <button
                type="button"
                className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-pulse-navy hover:bg-ds-interactive-hover dark:border-ds-border dark:bg-ds-elevated dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                onClick={() => setDetailPanel(detailPanel === "use" ? "none" : "use")}
              >
                Use in WR
              </button>
            </div>
          ) : null
        }
      >
        {detailLoading || !detail ? (
          <div className="flex items-center gap-2 text-pulse-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="space-y-5">
            {detailPanel === "assign" ? (
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                <p className={LABEL}>Assign to worker</p>
                <select
                  className={FIELD}
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                >
                  <option value="">Unassigned / return</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.full_name || w.email}
                    </option>
                  ))}
                </select>
                <button type="button" className={`${PRIMARY_BTN} mt-3 w-full`} disabled={actionBusy} onClick={runAssignFromDetail}>
                  Save assignment
                </button>
              </div>
            ) : null}
            {detailPanel === "move" ? (
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                <p className={LABEL}>Location (zone)</p>
                <select className={FIELD} value={moveZoneId} onChange={(e) => setMoveZoneId(e.target.value)}>
                  <option value="">Unspecified</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
                <button type="button" className={`${PRIMARY_BTN} mt-3 w-full`} disabled={actionBusy} onClick={runMoveFromDetail}>
                  Save move
                </button>
              </div>
            ) : null}
            {detailPanel === "use" ? (
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                <p className={LABEL}>Work request</p>
                <select className={FIELD} value={useWrId} onChange={(e) => setUseWrId(e.target.value)}>
                  <option value="">Select…</option>
                  {wrOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title}
                    </option>
                  ))}
                </select>
                <p className={`${LABEL} mt-3`}>Quantity</p>
                <input
                  className={FIELD}
                  inputMode="decimal"
                  value={useQty}
                  onChange={(e) => setUseQty(e.target.value)}
                />
                <p className="mt-2 text-xs text-pulse-muted">
                  Parts and consumables deduct stock. Tools log usage without quantity deduction.
                </p>
                <button type="button" className={`${PRIMARY_BTN} mt-3 w-full`} disabled={actionBusy} onClick={runUseFromDetail}>
                  Record usage
                </button>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                <p className="text-xs font-bold uppercase text-pulse-muted">Status &amp; quantity</p>
                <p className="mt-2 text-lg font-bold capitalize text-pulse-navy">{statusLabel(detail.inv_status)}</p>
                <p className="text-sm text-pulse-muted">
                  Qty: {detail.item_type === "tool" ? "1 (tracked)" : `${detail.quantity} ${detail.unit}`}
                </p>
                {detail.vendor?.trim() ? (
                  <p className="text-sm text-pulse-muted">Vendor: {detail.vendor}</p>
                ) : null}
                {detail.unit_cost != null ? (
                  <p className="text-sm text-pulse-muted">Unit cost: {formatUnitCost(detail.unit_cost)}</p>
                ) : null}
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                <p className="text-xs font-bold uppercase text-pulse-muted">Assignment &amp; location</p>
                <p className="mt-2 text-sm font-semibold text-pulse-navy">{detail.assignee_name ?? "Unassigned"}</p>
                <p className="text-sm text-pulse-muted">{detail.location_name ?? "—"}</p>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
              <p className="text-xs font-bold uppercase text-pulse-muted">Work requests</p>
              <ul className="mt-2 space-y-1 text-sm text-[#2B4C7E]">
                {detail.linked_work_requests.length === 0 ? (
                  <li className="text-pulse-muted">No linked work requests yet.</li>
                ) : (
                  detail.linked_work_requests.map((w) => (
                    <li key={w.id}>
                      <span className="font-semibold">#{w.id.slice(0, 8)}</span> — {w.title}
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
              <p className="text-xs font-bold uppercase text-pulse-muted">Usage log</p>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm">
                {detail.usage.length === 0 ? (
                  <li className="text-pulse-muted">No usage recorded.</li>
                ) : (
                  detail.usage.map((u) => (
                    <li key={u.id} className="border-b border-slate-100 pb-2 last:border-0">
                      <span className="font-semibold text-pulse-navy">{u.quantity}</span> in{" "}
                      <span className="text-[#2B4C7E]">
                        {u.work_request_title ?? `WR ${u.work_request_id.slice(0, 8)}`}
                      </span>
                      <span className="block text-xs text-pulse-muted">{formatTs(u.created_at)}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setMovementOpen((o) => !o)}
                aria-expanded={movementOpen}
              >
                <span className="text-xs font-bold uppercase text-pulse-muted">Movement timeline</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-pulse-muted transition-transform ${movementOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {movementOpen ? (
                <ul className="mt-3 space-y-3 text-sm">
                  {detail.movements.length === 0 ? (
                    <li className="text-pulse-muted">No movements.</li>
                  ) : (
                    detail.movements.map((m) => (
                      <li key={m.id} className="flex gap-3 border-l-2 border-slate-200 pl-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold capitalize text-pulse-navy">
                            {m.action.replace(/_/g, " ")}
                            {m.work_request_label ? (
                              <span className="ml-1 text-xs font-normal text-[#2B4C7E]">
                                ({m.work_request_label})
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-pulse-muted">
                            {m.performer_name ?? "System"} · {m.zone_name ?? "—"}
                            {m.quantity != null ? ` · qty ${m.quantity}` : ""}
                          </p>
                          <p className="text-[11px] text-pulse-muted">{formatTs(m.created_at)}</p>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
          </div>
        )}
      </PulseDrawer>

      <PulseDrawer
        open={editOpen}
        title={editMode === "create" ? "Register item" : "Edit item"}
        subtitle="Tools are individually tracked; parts and consumables use quantity."
        wide
        placement="center"
        onClose={() => {
          setEditOpen(false);
          setEditTargetId(null);
        }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-pulse-navy dark:border-ds-border dark:bg-ds-elevated dark:text-gray-100"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className={PRIMARY_BTN} disabled={actionBusy} onClick={() => void submitForm()}>
              Save
            </button>
          </div>
        }
      >
        {editFormLoading ? (
          <div className="flex items-center gap-2 py-8 text-pulse-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading item…
          </div>
        ) : null}
        <div className={`grid gap-4 sm:grid-cols-2 ${editFormLoading ? "pointer-events-none opacity-50" : ""}`}>
          <div className="sm:col-span-2">
            <label className={LABEL}>Name</label>
            <input className={FIELD} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL}>SKU (optional)</label>
            <input className={FIELD} value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL}>Type</label>
            <select
              className={FIELD}
              value={form.item_type}
              onChange={(e) => setForm((f) => ({ ...f, item_type: e.target.value }))}
            >
              <option value="tool">Tool</option>
              <option value="part">Part</option>
              <option value="consumable">Consumable</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Category</label>
            <select
              className={FIELD}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="">—</option>
              {mergedSettings.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Quantity</label>
            <input
              className={FIELD}
              inputMode="decimal"
              disabled={form.item_type === "tool"}
              value={form.item_type === "tool" ? "1" : form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </div>
          <div>
            <label className={LABEL}>Unit</label>
            <input className={FIELD} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL}>Min stock level</label>
            <input
              className={FIELD}
              inputMode="decimal"
              value={form.low_stock_threshold}
              onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))}
            />
          </div>
          <div>
            <label className={LABEL}>Condition</label>
            <select
              className={FIELD}
              value={form.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
            >
              <option value="good">Good</option>
              <option value="needs_maintenance">Needs maintenance</option>
              <option value="critical">Critical / out of service</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Location</label>
            <select
              className={FIELD}
              value={form.zone_id}
              onChange={(e) => setForm((f) => ({ ...f, zone_id: e.target.value }))}
            >
              <option value="">—</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Assigned worker</label>
            <select
              className={FIELD}
              value={form.assigned_user_id}
              onChange={(e) => setForm((f) => ({ ...f, assigned_user_id: e.target.value }))}
            >
              <option value="">—</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name || w.email}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Linked asset</label>
            <select
              className={FIELD}
              value={form.linked_tool_id}
              onChange={(e) => setForm((f) => ({ ...f, linked_tool_id: e.target.value }))}
            >
              <option value="">—</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.tag_id ? ` (${a.tag_id})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Vendor (optional)</label>
            <input
              className={FIELD}
              value={form.vendor}
              onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
              placeholder="Supplier or manufacturer"
            />
          </div>
          <div>
            <label className={LABEL}>Unit cost (optional)</label>
            <input
              className={FIELD}
              inputMode="decimal"
              value={form.unit_cost}
              onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-pulse-navy">
              <input
                type="checkbox"
                checked={form.reorder_flag}
                onChange={(e) => setForm((f) => ({ ...f, reorder_flag: e.target.checked }))}
              />
              Flag for reorder
            </label>
          </div>
        </div>
      </PulseDrawer>

      <PulseDrawer
        open={settingsOpen}
        wide
        title="Inventory settings"
        subtitle="Categories, thresholds, storage labels,and alert policies."
        placement="center"
        onClose={() => setSettingsOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-pulse-navy dark:border-ds-border dark:bg-ds-elevated dark:text-gray-100"
              onClick={() => setSettingsOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className={PRIMARY_BTN} disabled={actionBusy || settingsLoading} onClick={() => void saveSettings()}>
              Save
            </button>
          </div>
        }
      >
        {settingsLoading ? (
          <p className="text-sm text-pulse-muted">Loading settings…</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:border-r sm:border-slate-200 sm:pr-3">
              {SETTINGS_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSettingsTab(t)}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                    settingsTab === t
                      ? "bg-ds-accent/10 text-ds-accent dark:bg-ds-accent/15"
                      : "text-pulse-navy hover:bg-ds-interactive-hover dark:text-gray-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              {settingsTab === "Categories" ? (
                <div>
                  <p className={LABEL}>Categories (one per line)</p>
                  <textarea
                    className={`${FIELD} min-h-[140px] font-mono text-xs`}
                    value={settingsDraft.categories.join("\n")}
                    onChange={(e) =>
                      setSettingsDraft((d) => ({
                        ...d,
                        categories: draftLinesFromTextarea(e.target.value),
                      }))
                    }
                  />
                </div>
              ) : null}
              {settingsTab === "Status rules" ? (
                <div className="space-y-2">
                  <p className="text-sm text-pulse-muted">Toggle which statuses appear in default views.</p>
                  {(["in_stock", "assigned", "low_stock", "missing", "maintenance"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm font-medium text-pulse-navy">
                      <input
                        type="checkbox"
                        checked={settingsDraft.status_rules[k] !== false}
                        onChange={(e) =>
                          setSettingsDraft((d) => ({
                            ...d,
                            status_rules: { ...d.status_rules, [k]: e.target.checked },
                          }))
                        }
                      />
                      <span className="capitalize">{k.replace(/_/g, " ")}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              {settingsTab === "Thresholds" ? (
                <div>
                  <p className={LABEL}>Default minimum stock (new items)</p>
                  <input
                    className={FIELD}
                    inputMode="numeric"
                    value={String(settingsDraft.threshold_defaults.default_min ?? 5)}
                    onChange={(e) =>
                      setSettingsDraft((d) => ({
                        ...d,
                        threshold_defaults: {
                          ...d.threshold_defaults,
                          default_min: Number.parseInt(e.target.value, 10) || 0,
                        },
                      }))
                    }
                  />
                </div>
              ) : null}
              {settingsTab === "Alerts" ? (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-pulse-navy">
                    <input
                      type="checkbox"
                      checked={settingsDraft.alerts.low_stock !== false}
                      onChange={(e) =>
                        setSettingsDraft((d) => ({
                          ...d,
                          alerts: { ...d.alerts, low_stock: e.target.checked },
                        }))
                      }
                    />
                    Low stock alerts
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-pulse-navy">
                    <input
                      type="checkbox"
                      checked={settingsDraft.alerts.missing !== false}
                      onChange={(e) =>
                        setSettingsDraft((d) => ({
                          ...d,
                          alerts: { ...d.alerts, missing: e.target.checked },
                        }))
                      }
                    />
                    Missing item alerts
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </PulseDrawer>
    </div>
  );
}
