"use client";

/**
 * Inventory management: assets, parts, consumables — filters, KPIs, table, detail drawer,
 * movements / WR usage, settings (categories, thresholds, locations, alerts).
 * Matches Work Requests / Workers industrial shell styling.
 */
import {
  AlertTriangle,
  Box,
  ChevronDown,
  ClipboardList,
  Download,
  Loader2,
  MoreVertical,
  Package,
  Plus,
  Search,
  Settings,
  TrendingUp,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/lib/api";
import { pulseAppHref } from "@/lib/pulse-app";
import { inventoryScannerHref } from "@/lib/inventory-scanner/scanner-kiosk";
import {
  fetchPulseAssetsCached,
  fetchPulseWorkersOptsCached,
  fetchPulseZonesCached,
} from "@/lib/pulse/pulse-reference-data";
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
  fetchInventoryScopes,
  fetchInventorySettings,
  patchInventoryItem,
  patchInventorySettings,
  postInventoryAssign,
  postInventoryMove,
  postInventoryUse,
  uploadInventoryItemImage,
} from "@/lib/inventoryService";
import { usePermissions } from "@/hooks/usePermissions";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { canAccessCompanyConfiguration } from "@/lib/pulse-roles";
import { fetchWorkRequestList } from "@/lib/workRequestsService";
import { InventoryPurchasingPanels } from "@/components/inventory/InventoryPurchasingPanels";
import { InventoryVendorsPanel } from "@/components/inventory/InventoryVendorsPanel";
import {
  InventoryRegisterItemForm,
  registerFormStateToPayload,
  emptyRegisterFormState,
  type InventoryRegisterFormState,
} from "@/components/inventory/InventoryRegisterItemForm";
import {
  InventoryItemListThumb,
  InventoryItemProfilePhoto,
} from "@/components/inventory/InventoryItemPhotoUpload";
import { InventoryRegisterFieldsEditor } from "@/components/inventory/InventoryRegisterFieldsEditor";
import { InventoryDepartmentsPanel } from "@/components/inventory/InventoryDepartmentsPanel";
import { InventoryLocationsPanel } from "@/components/inventory/InventoryLocationsPanel";
import { InventoryPredictiveSearch } from "@/components/inventory/InventoryPredictiveSearch";
import { InventoryTransactionSettingsPanel } from "@/components/inventory/InventoryTransactionSettingsPanel";
import { InventoryMaterialRequestsPanel } from "@/components/inventory/InventoryMaterialRequestsPanel";
import { InventoryItemDetailFields } from "@/components/inventory/InventoryItemDetailFields";
import { InventoryTableFieldCell } from "@/components/inventory/InventoryTableFieldCell";
import {
  detailFieldsFromRegisterForm,
  tableColumnsFromRegisterForm,
} from "@/lib/inventory/inventory-list-columns";
import {
  InventorySetupWizard,
  mergedSettingsForSave,
} from "@/components/inventory/InventorySetupWizard";
import { referenceModeFromTransactions } from "@/lib/inventory/inventory-module-config";
import {
  mergeInventoryModuleSettings,
  registerFormCategoryFilterOptions,
  type MergedInventorySettings,
} from "@/lib/inventory/register-form-config";
import { defaultInventoryDepartmentFromSession } from "@/lib/inventory-department";
import {
  buildInventoryWorkspaceNav,
  type InventoryWorkspaceTab,
} from "@/lib/inventory/inventory-workspace-nav";
import {
  fetchPurchasingVendors,
  fetchQuickPurchases,
  type QuickPurchase,
  type VendorWithPerformance,
} from "@/lib/purchasing/purchasingService";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import {
  fetchTenantDepartments,
  tenantDepartmentNamesBySlug,
  type TenantDepartmentRow,
} from "@/lib/tenantDepartmentsService";

type CompanyOption = { id: string; name: string };
type ZoneOpt = { id: string; name: string };
type AssetOpt = { id: string; name: string; tag_id?: string | null };
type WorkerOpt = { id: string; email: string; full_name: string | null };

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");
const ICON_BTN = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "inline-flex h-10 w-10 items-center justify-center p-0",
);
const NAV_TAB =
  "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition whitespace-nowrap";
const NAV_TAB_ACTIVE = "bg-ds-accent text-ds-accent-foreground shadow-sm";
const NAV_TAB_IDLE =
  "text-pulse-muted hover:bg-ds-interactive-hover dark:hover:bg-ds-interactive-hover";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:placeholder:text-gray-500";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

const SETTINGS_TABS = [
  "Register form",
  "Departments",
  "Locations",
  "Transactions",
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

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function inventoryDepartmentLabel(slug: string | null | undefined, departments: TenantDepartmentRow[]): string {
  if (!slug) return "—";
  return departments.find((d) => d.slug === slug)?.name ?? slug;
}

function typeIcon(t: string) {
  if (t === "tool") return Wrench;
  if (t === "consumable") return Box;
  return Package;
}

/** Short labels so KPI tiles fit in one mobile row. */
function inventoryMetricShortLabel(label: string): string {
  if (label === "Total items") return "Items";
  if (label === "In stock") return "Stock";
  if (label === "Low stock") return "Low";
  if (label === "Inventory value") return "Value";
  const top = /^Top (\d) by uses$/.exec(label);
  if (top) return `Top ${top[1]}`;
  return label;
}

export function InventoryApp() {
  const { session } = usePulseAuth();
  const { can } = usePermissions();
  const canConfigureOrg = canAccessCompanyConfiguration(session);
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const sessionCompanyId = session?.company_id ?? null;
  const canViewInventory = can("inventory.view") || can("inventory.manage");
  const canMutateInventory = can("inventory.manage");
  /** One-time inventory setup: company admins or inventory managers with manage permission. */
  const canRunInventorySetup = canMutateInventory || canConfigureOrg;
  const canOpenScannerKiosk = can("inventory.scan") || can("inventory.manage");
  const userInventoryDepartment = defaultInventoryDepartmentFromSession(session);

  const [companyPick, setCompanyPick] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const effectiveCompanyId = isSystemAdmin ? companyPick : sessionCompanyId;
  const dataEnabled = Boolean(effectiveCompanyId) && canViewInventory;
  const apiCompany = isSystemAdmin ? effectiveCompanyId : null;

  const [inventoryTab, setInventoryTab] = useState<InventoryWorkspaceTab>("list");
  const [departmentFilter, setDepartmentFilter] = useState(() => (canConfigureOrg ? "" : userInventoryDepartment));
  const directoryDepartmentSlug = canConfigureOrg ? departmentFilter || undefined : userInventoryDepartment;
  const [quickPurchases, setQuickPurchases] = useState<QuickPurchase[]>([]);
  const [purchasingVendors, setPurchasingVendors] = useState<VendorWithPerformance[]>([]);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [scopeAdminFilter, setScopeAdminFilter] = useState("");
  const [scopeOptions, setScopeOptions] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const [zones, setZones] = useState<ZoneOpt[]>([]);
  const [tenantDepartments, setTenantDepartments] = useState<TenantDepartmentRow[]>([]);
  const [assets, setAssets] = useState<AssetOpt[]>([]);
  const [workers, setWorkers] = useState<WorkerOpt[]>([]);
  const [settingsBaseline, setSettingsBaseline] = useState<InventoryModuleSettings>({});
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [setupWizardDraft, setSetupWizardDraft] = useState<MergedInventorySettings | null>(null);
  const [setupWizardDismissed, setSetupWizardDismissed] = useState(false);
  const [setupSaveError, setSetupSaveError] = useState<string | null>(null);

  const inventorySetupDismissKey =
    effectiveCompanyId != null ? `pulse.inventory.setup.dismissed.${effectiveCompanyId}` : null;

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<InventorySummary | null>(null);

  const mergedSettings = useMemo(() => mergeInventoryModuleSettings(settingsBaseline), [settingsBaseline]);
  const tableColumns = useMemo(
    () => tableColumnsFromRegisterForm(mergedSettings.register_form),
    [mergedSettings.register_form],
  );
  const detailExtraFields = useMemo(
    () => detailFieldsFromRegisterForm(mergedSettings.register_form),
    [mergedSettings.register_form],
  );
  const categoryFilterOptions = useMemo(
    () =>
      registerFormCategoryFilterOptions(
        mergedSettings.register_form,
        rows.map((r) => r.category ?? ""),
      ),
    [mergedSettings.register_form, rows],
  );
  const departmentNamesBySlug = useMemo(
    () => tenantDepartmentNamesBySlug(tenantDepartments),
    [tenantDepartments],
  );

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("Register form");
  const [settingsDraft, setSettingsDraft] = useState<MergedInventorySettings>(() => mergeInventoryModuleSettings({}));
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsLocationError, setSettingsLocationError] = useState<string | null>(null);
  const [settingsDepartmentError, setSettingsDepartmentError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InventoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [movementOpen, setMovementOpen] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<"create" | "edit">("create");
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editFormLoading, setEditFormLoading] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [form, setForm] = useState<InventoryRegisterFormState>(() => emptyRegisterFormState());

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
    if (!canConfigureOrg || !dataEnabled || !effectiveCompanyId) {
      setScopeOptions([]);
      setScopeAdminFilter("");
      return;
    }
    void (async () => {
      try {
        const rows = await fetchInventoryScopes(apiCompany);
        setScopeOptions(rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug })));
      } catch {
        setScopeOptions([]);
      }
    })();
  }, [canConfigureOrg, dataEnabled, effectiveCompanyId, apiCompany]);

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
      setTenantDepartments([]);
      setAssets([]);
      setWorkers([]);
      return;
    }
    void (async () => {
      try {
        const [z, a, w, depts] = await Promise.all([
          fetchPulseZonesCached(),
          fetchPulseAssetsCached(),
          fetchPulseWorkersOptsCached(),
          fetchTenantDepartments(apiCompany),
        ]);
        setZones(z);
        setAssets(a);
        setWorkers(w);
        setTenantDepartments(depts);
      } catch {
        setZones([]);
        setTenantDepartments([]);
        setAssets([]);
        setWorkers([]);
      }
    })();
  }, [dataEnabled, session?.access_token, apiCompany]);

  const loadSettings = useCallback(async () => {
    if (!effectiveCompanyId) {
      setSettingsBaseline({});
      setSettingsHydrated(false);
      return null;
    }
    try {
      const r = await fetchInventorySettings(apiCompany);
      const settings = r.settings ?? {};
      setSettingsBaseline(settings);
      return settings;
    } catch {
      setSettingsBaseline({});
      return null;
    } finally {
      setSettingsHydrated(true);
    }
  }, [apiCompany, effectiveCompanyId]);

  useEffect(() => {
    setSettingsHydrated(false);
    void loadSettings();
  }, [loadSettings]);

  const loadPurchasingData = useCallback(async () => {
    if (!dataEnabled) return;
    const pc = mergedSettings.purchasing;
    if (!pc.enabled) {
      setQuickPurchases([]);
      setPurchasingVendors([]);
      return;
    }
    try {
      const tasks: Promise<void>[] = [];
      if (pc.enable_purchase_history || pc.enable_receipt_uploads) {
        tasks.push(
          fetchQuickPurchases(apiCompany).then((list) => {
            setQuickPurchases(list.items);
          }),
        );
      } else {
        setQuickPurchases([]);
      }
      if (pc.enable_vendor_tracking) {
        tasks.push(
          fetchPurchasingVendors(apiCompany).then((list) => {
            setPurchasingVendors(list);
          }),
        );
      } else {
        setPurchasingVendors([]);
      }
      await Promise.all(tasks);
    } catch {
      setQuickPurchases([]);
      setPurchasingVendors([]);
    }
  }, [apiCompany, dataEnabled, mergedSettings.purchasing]);

  useEffect(() => {
    void loadPurchasingData();
  }, [loadPurchasingData]);

  const workspaceNav = useMemo(
    () =>
      buildInventoryWorkspaceNav({
        purchasing: mergedSettings.purchasing,
        replenishmentLabel: mergedSettings.purchasing.replenishment_label,
        canScanner: canOpenScannerKiosk,
        issueHref: pulseAppHref(inventoryScannerHref({ mode: "issue" })),
        receiveHref: pulseAppHref(inventoryScannerHref({ mode: "receive" })),
        kioskHref: pulseAppHref(inventoryScannerHref({ kioskDisplay: true })),
      }),
    [mergedSettings.purchasing, canOpenScannerKiosk],
  );

  useEffect(() => {
    if (!workspaceNav.some((n) => n.kind === "tab" && n.id === inventoryTab)) {
      const first = workspaceNav.find((n) => n.kind === "tab");
      if (first && first.kind === "tab") setInventoryTab(first.id);
    }
  }, [workspaceNav, inventoryTab]);

  useEffect(() => {
    if (!inventorySetupDismissKey || typeof window === "undefined") return;
    setSetupWizardDismissed(sessionStorage.getItem(inventorySetupDismissKey) === "1");
  }, [inventorySetupDismissKey]);

  useEffect(() => {
    if (!settingsHydrated || !dataEnabled || !canRunInventorySetup) return;
    if (mergedSettings.setup_completed) {
      setSetupWizardOpen(false);
      return;
    }
    if (setupWizardDismissed) return;
    setSetupWizardDraft(mergeInventoryModuleSettings(settingsBaseline));
    setSetupWizardOpen(true);
  }, [
    settingsHydrated,
    dataEnabled,
    canRunInventorySetup,
    mergedSettings.setup_completed,
    setupWizardDismissed,
    settingsBaseline,
  ]);

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
        department_slug: departmentFilter || undefined,
        scope_id: canConfigureOrg && scopeAdminFilter ? scopeAdminFilter : undefined,
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
    departmentFilter,
    scopeAdminFilter,
    canConfigureOrg,
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
        setSettingsDraft(mergeInventoryModuleSettings(base));
      } catch {
        setSettingsDraft(mergeInventoryModuleSettings({}));
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
    setDepartmentFilter("");
    setScopeAdminFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  function clearPendingPhoto() {
    setPendingPhotoFile(null);
    setPendingPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  function openCreate() {
    setEditMode("create");
    setEditTargetId(null);
    setEditImageUrl(null);
    clearPendingPhoto();
    const dept = directoryDepartmentSlug ?? userInventoryDepartment;
    setForm(
      emptyRegisterFormState(mergedSettings.threshold_defaults.default_min ?? 5, dept),
    );
    setEditOpen(true);
  }

  const formFromRow = useCallback(
    (
      row: Pick<
        InventoryRow,
        | "name"
        | "sku"
        | "item_type"
        | "category"
        | "quantity"
        | "unit"
        | "low_stock_threshold"
        | "zone_id"
        | "assigned_user_id"
        | "linked_tool_id"
        | "department_slug"
        | "condition"
        | "unit_cost"
        | "vendor"
        | "reorder_flag"
        | "custom_attributes"
      >,
    ) => {
      const custom_attributes: Record<string, string | boolean> = {};
      const attrs = row.custom_attributes ?? {};
      for (const [k, v] of Object.entries(attrs)) {
        if (typeof v === "boolean") custom_attributes[k] = v;
        else if (v != null) custom_attributes[k] = String(v);
      }
      return {
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
        department_slug: row.department_slug ?? "maintenance",
        condition: row.condition,
        unit_cost: row.unit_cost != null ? String(row.unit_cost) : "",
        vendor: row.vendor ?? "",
        reorder_flag: row.reorder_flag,
        custom_attributes,
      };
    },
    [],
  );

  function openEdit(row: InventoryRow) {
    setEditMode("edit");
    setEditTargetId(row.id);
    setEditImageUrl(row.image_url ?? null);
    clearPendingPhoto();
    setForm(formFromRow(row));
    setEditOpen(true);
  }

  function openEditFromDetail(d: InventoryDetail) {
    setEditMode("edit");
    setEditTargetId(d.id);
    setEditImageUrl(d.image_url ?? null);
    clearPendingPhoto();
    setForm(formFromRow(d));
    setEditOpen(true);
  }

  useEffect(() => {
    if (!editOpen || editMode !== "edit" || !editTargetId || !effectiveCompanyId) return;
    setEditFormLoading(true);
    void (async () => {
      try {
        const d = await fetchInventoryDetail(apiCompany, editTargetId);
        setEditImageUrl(d.image_url ?? null);
        setForm(formFromRow(d));
      } catch {
        /* keep table row snapshot */
      } finally {
        setEditFormLoading(false);
      }
    })();
  }, [editOpen, editMode, editTargetId, effectiveCompanyId, apiCompany, formFromRow]);

  async function submitForm() {
    if (!effectiveCompanyId || !form.name.trim() || !canMutateInventory) return;
    setActionBusy(true);
    try {
      const payload = registerFormStateToPayload(form, mergedSettings.register_form);
      let savedId: string | null = editTargetId;
      if (editMode === "create") {
        const d = await createInventoryItem(apiCompany, payload);
        savedId = d.id;
        setEditOpen(false);
        setEditTargetId(null);
        setDetailId(d.id);
      } else if (editTargetId) {
        const eid = editTargetId;
        await patchInventoryItem(apiCompany, eid, {
          ...payload,
          sku: payload.sku ?? undefined,
        });
        savedId = eid;
        setEditOpen(false);
        setEditTargetId(null);
        if (detailId === eid) await loadDetail();
      }
      if (savedId && pendingPhotoFile) {
        await uploadInventoryItemImage(apiCompany, savedId, pendingPhotoFile);
        clearPendingPhoto();
      }
      await loadList();
    } finally {
      setActionBusy(false);
    }
  }

  async function saveSettings() {
    if (!effectiveCompanyId || !canMutateInventory) return;
    setActionBusy(true);
    try {
      await patchInventorySettings(apiCompany, mergedSettingsForSave(settingsDraft));
      setSettingsOpen(false);
      await loadSettings();
    } finally {
      setActionBusy(false);
    }
  }

  async function completeSetupWizard(next: MergedInventorySettings) {
    if (!effectiveCompanyId || !canRunInventorySetup) return;
    setActionBusy(true);
    setSetupSaveError(null);
    try {
      const payload = mergedSettingsForSave(next);
      const saved = await patchInventorySettings(apiCompany, payload);
      setSettingsBaseline(saved.settings ?? payload);
      setSettingsHydrated(true);
      if (inventorySetupDismissKey) {
        sessionStorage.removeItem(inventorySetupDismissKey);
      }
      setSetupWizardOpen(false);
      setSetupWizardDraft(null);
      await loadList();
      void loadPurchasingData();
    } catch (e: unknown) {
      setSetupSaveError(e instanceof Error ? e.message : "Could not save inventory setup");
    } finally {
      setActionBusy(false);
    }
  }

  async function runAssignFromDetail() {
    if (!detailId || !canMutateInventory) return;
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
    if (!detailId || !canMutateInventory) return;
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
    if (!detailId || !useWrId || !canMutateInventory) return;
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
    if (!canMutateInventory) return;
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
      "Department",
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
        inventoryDepartmentLabel(r.department_slug, tenantDepartments),
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

  if (!canViewInventory) {
    return (
      <p className="text-sm text-pulse-muted">
        You do not have permission to view inventory. Ask a company administrator to grant{" "}
        <span className="font-mono text-pulse-navy dark:text-gray-200">inventory.view</span> or{" "}
        <span className="font-mono text-pulse-navy dark:text-gray-200">inventory.manage</span>.
      </p>
    );
  }

  const sum = summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        icon={Package}
        divider={false}
        actions={
          canConfigureOrg ? (
            <button
              type="button"
              className={ICON_BTN}
              title="Inventory settings"
              aria-label="Inventory settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" aria-hidden />
            </button>
          ) : null
        }
      />

      {dataEnabled ? (
        <div className="-mt-2 flex flex-wrap gap-1 rounded-lg border border-pulse-border bg-white p-1 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          {workspaceNav.map((item) => {
            const Icon = item.icon;
            if (item.kind === "link") {
              const className = cn(NAV_TAB, NAV_TAB_IDLE);
              return item.external ? (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                  title={item.label}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </a>
              ) : (
                <Link key={item.label} href={item.href} className={className} title={item.label}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            }
            const active = inventoryTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setInventoryTab(item.id)}
                className={cn(NAV_TAB, active ? NAV_TAB_ACTIVE : NAV_TAB_IDLE)}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}

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
          {inventoryTab === "list" ? (
            <InventoryPredictiveSearch
              canTransact={canOpenScannerKiosk}
              onOpenItem={(id) => {
                setDetailId(id);
                setMovementOpen(true);
              }}
            />
          ) : null}

          {inventoryTab === "queue" ? (
            <InventoryMaterialRequestsPanel
              apiCompany={apiCompany}
              canMutate={canMutateInventory}
              procurementActionLabel={mergedSettings.inventory.procurement_action_label}
              replenishmentLabel={mergedSettings.purchasing.replenishment_label}
              notificationEmailDirectory={mergedSettings.notifications.email_directory}
              defaultMrExportEmails={mergedSettings.notifications.mr_export_emails}
            />
          ) : null}

          {inventoryTab === "vendors" ? (
            mergedSettings.purchasing.enabled && mergedSettings.purchasing.enable_vendor_tracking ? (
              <InventoryPurchasingPanels
                apiCompany={apiCompany}
                tab="vendors"
                config={mergedSettings.purchasing}
                purchases={quickPurchases}
                vendors={purchasingVendors}
                onPurchaseSaved={() => void loadPurchasingData()}
              />
            ) : (
              <InventoryVendorsPanel apiCompany={apiCompany} departmentSlug={directoryDepartmentSlug} />
            )
          ) : null}

          {inventoryTab === "quick_purchase" ? (
            <InventoryPurchasingPanels
              apiCompany={apiCompany}
              tab="quick_purchase"
              config={mergedSettings.purchasing}
              purchases={quickPurchases}
              vendors={purchasingVendors}
              onPurchaseSaved={() => void loadPurchasingData()}
            />
          ) : null}

          {inventoryTab === "receipts" || inventoryTab === "history" ? (
            <InventoryPurchasingPanels
              apiCompany={apiCompany}
              tab={inventoryTab}
              config={mergedSettings.purchasing}
              purchases={quickPurchases}
              vendors={purchasingVendors}
              onPurchaseSaved={() => void loadPurchasingData()}
            />
          ) : null}

          {inventoryTab === "list" && sum ? (
            <div className="mt-4 grid grid-cols-7 gap-1.5 sm:mt-6 sm:gap-2 lg:gap-3">
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
                  className={cn(
                    "flex aspect-square min-w-0 flex-col items-center justify-center rounded-md border bg-white p-1.5 text-center shadow-sm ring-1 dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:p-2",
                    "lg:aspect-auto lg:items-stretch lg:justify-start lg:p-4 lg:text-left",
                    "alert" in card && card.alert
                      ? "border-amber-200 ring-amber-100/90 dark:border-amber-500/35 dark:ring-amber-500/20"
                      : "border-pulse-border ring-slate-100/80 dark:border-ds-border dark:ring-white/[0.06]",
                  )}
                >
                  <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 lg:hidden">
                    <card.icon className={cn("h-3.5 w-3.5 shrink-0 opacity-80", card.tone)} aria-hidden />
                    <p className="line-clamp-2 text-[9px] font-bold uppercase leading-tight tracking-wide text-pulse-muted sm:text-[10px]">
                      {inventoryMetricShortLabel(card.label)}
                    </p>
                    <p className="max-w-full truncate text-sm font-bold tabular-nums text-pulse-navy dark:text-gray-100">
                      {card.value}
                    </p>
                  </div>
                  <div className="hidden min-w-0 lg:block">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-pulse-muted">{card.label}</p>
                      <card.icon className={cn("h-5 w-5 shrink-0 opacity-80", card.tone)} aria-hidden />
                    </div>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-pulse-navy dark:text-gray-100">
                      {card.value}
                    </p>
                    {card.sub ? (
                      <p
                        className={cn(
                          "mt-0.5 text-xs font-semibold",
                          "alert" in card && card.alert ? "text-rose-600" : "text-pulse-muted",
                        )}
                      >
                        {card.sub}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {inventoryTab === "list" ? (
          <>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { id: "", label: "All" },
              { id: "in_stock", label: "In stock" },
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
                  {categoryFilterOptions.map((c) => (
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
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Department</option>
                {tenantDepartments.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </select>
              {canConfigureOrg ? (
                <select
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
                  value={scopeAdminFilter}
                  onChange={(e) => {
                    setScopeAdminFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All scopes</option>
                  {scopeOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : null}
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
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="text-sm font-semibold text-[#2B4C7E] hover:underline" onClick={clearFilters}>
                Clear filters
              </button>
              <button
                type="button"
                className={ICON_BTN}
                title="Export list as CSV"
                aria-label="Export list as CSV"
                disabled={rows.length === 0}
                onClick={() => exportCsv()}
              >
                <Download className="h-4 w-4" aria-hidden />
              </button>
              {canMutateInventory ? (
                <button
                  type="button"
                  className={ICON_BTN}
                  title="Register item"
                  aria-label="Register item"
                  disabled={!dataEnabled}
                  onClick={() => openCreate()}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
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
                <table className="min-w-[960px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="app-table-head-row border-pulse-border">
                      <th className="px-4 py-3">Item</th>
                      {tableColumns.map((col) => (
                        <th key={col.kind === "field" ? col.field.id : col.kind} className="px-4 py-3">
                          {col.kind === "field"
                            ? col.field.label
                            : col.kind === "type_category"
                              ? col.label
                              : col.label}
                        </th>
                      ))}
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
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-3">
                              <InventoryItemListThumb
                                imageUrl={row.image_url}
                                name={row.name}
                                FallbackIcon={Icon}
                              />
                              <div className="min-w-0">
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
                          {tableColumns.map((col) => (
                            <InventoryTableFieldCell
                              key={col.kind === "field" ? col.field.id : col.kind}
                              column={col}
                              row={row}
                              departmentNamesBySlug={departmentNamesBySlug}
                            />
                          ))}
                          <td className="relative px-4 py-3 text-right align-top" onClick={(e) => e.stopPropagation()}>
                            {canMutateInventory ? (
                              <>
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
                              </>
                            ) : (
                              <span className="text-xs text-pulse-muted">—</span>
                            )}
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
              {canMutateInventory ? (
                <>
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
                </>
              ) : (
                <p className="text-xs text-pulse-muted">View only — inventory.manage is required to change items.</p>
              )}
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
            {detailPanel === "assign" && canMutateInventory ? (
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
            {detailPanel === "move" && canMutateInventory ? (
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
            {detailPanel === "use" && canMutateInventory ? (
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

            <InventoryItemProfilePhoto
              imageUrl={detail.image_url}
              name={detail.name}
              itemId={detail.id}
              canEdit={canMutateInventory}
              uploadFile={(file) => uploadInventoryItemImage(apiCompany, detail.id, file)}
              onUploadComplete={(url) => {
                setDetail((d) => (d ? { ...d, image_url: url } : d));
                setRows((prev) =>
                  prev.map((r) => (r.id === detail.id ? { ...r, image_url: url } : r)),
                );
              }}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                <p className="text-xs font-bold uppercase text-pulse-muted">Status &amp; quantity</p>
                <p className="mt-2 text-lg font-bold capitalize text-pulse-navy">{statusLabel(detail.inv_status)}</p>
                <p className="text-sm text-pulse-muted">
                  Qty: {detail.item_type === "tool" ? "1 (tracked)" : `${detail.quantity} ${detail.unit}`}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                <p className="text-xs font-bold uppercase text-pulse-muted">Assignment &amp; location</p>
                <p className="mt-2 text-sm font-semibold text-pulse-navy">{detail.assignee_name ?? "Unassigned"}</p>
                <p className={`${LABEL} mt-3`}>Location</p>
                {canMutateInventory ? (
                  <select
                    className={FIELD}
                    value={detail.zone_id ?? ""}
                    disabled={actionBusy}
                    onChange={(e) => {
                      const zone_id = e.target.value || null;
                      void (async () => {
                        setActionBusy(true);
                        try {
                          await postInventoryMove(apiCompany, detail.id, zone_id);
                          await loadDetail();
                          await loadList();
                        } finally {
                          setActionBusy(false);
                        }
                      })();
                    }}
                  >
                    <option value="">Unspecified</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-pulse-muted">{detail.location_name ?? "—"}</p>
                )}
                {zones.length === 0 && canMutateInventory ? (
                  <p className="mt-2 text-xs text-pulse-muted">
                    Add locations under Inventory settings → Locations.
                  </p>
                ) : null}
              </div>
            </div>

            <InventoryItemDetailFields
              detail={detail}
              fields={detailExtraFields}
              departmentNamesBySlug={departmentNamesBySlug}
            />

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
        subtitle={mergedSettings.register_form.subtitle}
        wide
        placement="center"
        onClose={() => {
          setEditOpen(false);
          setEditTargetId(null);
          clearPendingPhoto();
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
        <InventoryRegisterItemForm
          registerForm={mergedSettings.register_form}
          form={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          zones={zones}
          assets={assets}
          workers={workers}
          departments={tenantDepartments}
          disabled={editFormLoading}
          inventoryCompanyId={apiCompany}
          itemId={editMode === "edit" ? editTargetId : null}
          imageUrl={editImageUrl}
          pendingPhotoPreview={pendingPhotoPreview}
          onPendingPhoto={(file) => {
            setPendingPhotoFile(file);
            setPendingPhotoPreview((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return file ? URL.createObjectURL(file) : null;
            });
          }}
          onPhotoUploaded={(url) => setEditImageUrl(url)}
          uploadPhoto={
            editTargetId
              ? (file) => uploadInventoryItemImage(apiCompany, editTargetId, file)
              : undefined
          }
        />
      </PulseDrawer>

      <PulseDrawer
        open={settingsOpen}
        wide
        title="Inventory settings"
        subtitle="Categories, register form, thresholds, storage labels, and alert policies."
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
              {canRunInventorySetup ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-[#2B4C7E] underline-offset-2 hover:underline"
                  onClick={() => {
                    setSetupWizardDraft(settingsDraft);
                    setSetupWizardOpen(true);
                    setSetupWizardDismissed(false);
                    if (inventorySetupDismissKey) {
                      sessionStorage.removeItem(inventorySetupDismissKey);
                    }
                  }}
                >
                  Open setup wizard
                </button>
              ) : null}
              {settingsTab === "Register form" ? (
                <InventoryRegisterFieldsEditor
                  registerForm={settingsDraft.register_form}
                  onChange={(register_form) => setSettingsDraft((d) => ({ ...d, register_form }))}
                />
              ) : null}
              {settingsTab === "Departments" ? (
                <div className="space-y-3">
                  {settingsDepartmentError ? (
                    <p className="text-sm text-rose-600">{settingsDepartmentError}</p>
                  ) : null}
                  <InventoryDepartmentsPanel
                    companyId={apiCompany}
                    departments={tenantDepartments}
                    onDepartmentsChange={setTenantDepartments}
                    canManage={canMutateInventory || canConfigureOrg}
                    busy={actionBusy}
                    onBusyChange={setActionBusy}
                    onError={setSettingsDepartmentError}
                  />
                </div>
              ) : null}
              {settingsTab === "Locations" ? (
                <div className="space-y-3">
                  {settingsLocationError ? (
                    <p className="text-sm text-rose-600">{settingsLocationError}</p>
                  ) : null}
                  <InventoryLocationsPanel
                    companyId={apiCompany}
                    zones={zones}
                    onZonesChange={setZones}
                    canManage={canMutateInventory || canConfigureOrg}
                    busy={actionBusy}
                    onBusyChange={setActionBusy}
                    onError={setSettingsLocationError}
                  />
                </div>
              ) : null}
              {settingsTab === "Transactions" ? (
                <InventoryTransactionSettingsPanel
                  value={settingsDraft.transactions}
                  onChange={(transactions) =>
                    setSettingsDraft((d) => ({
                      ...d,
                      transactions,
                      inventory: {
                        ...d.inventory,
                        reference_mode: referenceModeFromTransactions(transactions),
                      },
                    }))
                  }
                  disabled={actionBusy}
                />
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
                  <p className="text-xs text-pulse-muted">
                    Email recipients are configured per organization under{" "}
                    <a href="/dashboard/organization" className="font-semibold text-pulse-accent underline">
                      Company branding
                    </a>{" "}
                    or{" "}
                    <a href="/dashboard/permissions" className="font-semibold text-pulse-accent underline">
                      Permissions → Settings → Notifications
                    </a>
                    . Server SMTP must be enabled.
                  </p>
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

      {setupSaveError && setupWizardOpen ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {setupSaveError}
        </p>
      ) : null}

      {setupWizardDraft ? (
        <InventorySetupWizard
          open={setupWizardOpen}
          busy={actionBusy}
          draft={setupWizardDraft}
          onDraftChange={setSetupWizardDraft}
          onComplete={(next) => completeSetupWizard(next)}
          onSkip={() => {
            setSetupWizardOpen(false);
            setSetupWizardDismissed(true);
            setSetupSaveError(null);
            if (inventorySetupDismissKey) {
              sessionStorage.setItem(inventorySetupDismissKey, "1");
            }
          }}
        />
      ) : null}
    </div>
  );
}
