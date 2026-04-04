"use client";

/**
 * Facility equipment registry: overview, sortable/filterable list, add/edit/view form.
 * Matches Monitoring / Inventory shell styling.
 */
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/lib/api";
import {
  createEquipment,
  deleteEquipment,
  type FacilityEquipmentCreate,
  type FacilityEquipmentRow,
  fetchEquipment,
  fetchEquipmentList,
  patchEquipment,
} from "@/lib/equipmentService";
import { usePulseAuth } from "@/hooks/usePulseAuth";

type ZoneOpt = { id: string; name: string };

const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";
const SECONDARY_BTN =
  "rounded-[10px] border border-slate-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 disabled:opacity-60";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

const TYPE_SUGGESTIONS = ["General", "HVAC", "Mechanical / fluid", "Electrical", "Tools", "Safety", "Other"];
const STATUS_OPTS = [
  { value: "active", label: "Active" },
  { value: "maintenance", label: "Maintenance" },
  { value: "offline", label: "Offline" },
];

type Tab = "overview" | "list" | "form";
type FormMode = "create" | "edit" | "view";

function managerOrAbove(role: string | undefined, isSys: boolean | undefined): boolean {
  if (isSys || role === "system_admin") return true;
  return role === "manager" || role === "company_admin";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusBadge(status: string): string {
  switch (status) {
    case "maintenance":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
    case "offline":
      return "bg-slate-100 text-pulse-muted ring-1 ring-slate-200/80";
    default:
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80";
  }
}

export function EquipmentApp() {
  const router = useRouter();
  const { session } = usePulseAuth();
  const canMutate = managerOrAbove(session?.role, session?.is_system_admin);

  const [tab, setTab] = useState<Tab>("overview");
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [formId, setFormId] = useState<string | null>(null);

  const [zones, setZones] = useState<ZoneOpt[]>([]);
  const [items, setItems] = useState<FacilityEquipmentRow[]>([]);
  const [statsItems, setStatsItems] = useState<FacilityEquipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const [search, setSearch] = useState("");
  const [filterZone, setFilterZone] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sort, setSort] = useState<"name" | "type" | "status" | "last_service_date" | "updated_at" | "zone_name">(
    "name",
  );
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const [toast, setToast] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("General");
  const [formZoneId, setFormZoneId] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [formManufacturer, setFormManufacturer] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [formInstall, setFormInstall] = useState("");
  const [formLastService, setFormLastService] = useState("");
  const [formNextService, setFormNextService] = useState("");
  const [formServiceInterval, setFormServiceInterval] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadZones = useCallback(async () => {
    try {
      const z = await apiFetch<ZoneOpt[]>("/api/v1/pulse/zones");
      setZones(z);
    } catch {
      setZones([]);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const rows = await fetchEquipmentList({});
      setStatsItems(rows);
    } catch {
      setStatsItems([]);
    }
  }, []);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const rows = await fetchEquipmentList({
        q: search.trim() || undefined,
        zone_id: filterZone || undefined,
        type: filterType || undefined,
        status: filterStatus || undefined,
        sort,
        order,
      });
      setItems(rows);
      setBlocked(false);
    } catch (e: unknown) {
      const st = (e as { status?: number; body?: { detail?: string; feature?: string } })?.status;
      const body = (e as { body?: { detail?: string; feature?: string } })?.body;
      if (st === 403 && body?.detail === "feature_disabled") {
        setBlocked(true);
      } else {
        setError("Could not load equipment.");
      }
      setItems([]);
    } finally {
      setListLoading(false);
    }
  }, [search, filterZone, filterType, filterStatus, sort, order]);

  useEffect(() => {
    void loadZones();
  }, [loadZones]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadStats();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStats]);

  useEffect(() => {
    if (tab === "list") void loadList();
  }, [tab, loadList]);

  useEffect(() => {
    if (tab === "overview") void loadStats();
  }, [tab, loadStats]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormType("General");
    setFormZoneId("");
    setFormStatus("active");
    setFormManufacturer("");
    setFormModel("");
    setFormSerial("");
    setFormInstall("");
    setFormLastService("");
    setFormNextService("");
    setFormServiceInterval("");
    setFormNotes("");
    setFormError(null);
    setFormId(null);
    setFormMode("create");
  }, []);

  const populateFromRow = useCallback((r: FacilityEquipmentRow) => {
    setFormName(r.name);
    setFormType(r.type || "General");
    setFormZoneId(r.zone_id ?? "");
    setFormStatus(r.status);
    setFormManufacturer(r.manufacturer ?? "");
    setFormModel(r.model ?? "");
    setFormSerial(r.serial_number ?? "");
    setFormInstall(r.installation_date ? r.installation_date.slice(0, 10) : "");
    setFormLastService(r.last_service_date ? r.last_service_date.slice(0, 10) : "");
    setFormNextService(r.next_service_date ? r.next_service_date.slice(0, 10) : "");
    setFormServiceInterval(
      r.service_interval_days != null && r.service_interval_days > 0 ? String(r.service_interval_days) : "",
    );
    setFormNotes(r.notes ?? "");
  }, []);

  const openCreate = useCallback(() => {
    resetForm();
    setFormMode("create");
    setTab("form");
  }, [resetForm]);

  const openView = useCallback(
    async (id: string) => {
      setFormError(null);
      try {
        const r = await fetchEquipment(id);
        setFormId(id);
        setFormMode("view");
        populateFromRow(r);
        setTab("form");
      } catch {
        setFormError("Could not load equipment.");
      }
    },
    [populateFromRow],
  );

  const openEdit = useCallback(
    async (id: string) => {
      if (!canMutate) return;
      setFormError(null);
      try {
        const r = await fetchEquipment(id);
        setFormId(id);
        setFormMode("edit");
        populateFromRow(r);
        setTab("form");
      } catch {
        setFormError("Could not load equipment.");
      }
    },
    [canMutate, populateFromRow],
  );

  const onSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === "view") return;
    if (!formName.trim()) {
      setFormError("Equipment name is required.");
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    const intervalRaw = formServiceInterval.trim();
    const intervalParsed = intervalRaw ? parseInt(intervalRaw, 10) : NaN;
    const service_interval_days =
      intervalRaw && !Number.isNaN(intervalParsed) && intervalParsed >= 1 ? intervalParsed : null;

    const payload: FacilityEquipmentCreate = {
      name: formName.trim(),
      type: formType.trim() || "General",
      zone_id: formZoneId || null,
      status: formStatus,
      manufacturer: formManufacturer.trim() || null,
      model: formModel.trim() || null,
      serial_number: formSerial.trim() || null,
      installation_date: formInstall || null,
      last_service_date: formLastService || null,
      next_service_date: formNextService || null,
      service_interval_days,
      notes: formNotes.trim() || null,
    };
    try {
      if (formMode === "create") {
        await createEquipment(payload);
        setToast("Equipment added.");
      } else if (formId) {
        await patchEquipment(formId, payload);
        setToast("Equipment updated.");
      }
      resetForm();
      setTab("list");
      await loadList();
      await loadStats();
    } catch {
      setFormError("Save failed. Check your connection and permissions.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!canMutate || !confirm("Delete this equipment record?")) return;
    try {
      await deleteEquipment(id);
      setToast("Equipment deleted.");
      await loadList();
      await loadStats();
      if (formId === id) {
        resetForm();
        setTab("list");
      }
    } catch {
      setToast("Delete failed.");
    }
  };

  const toggleSort = (col: typeof sort) => {
    if (sort === col) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setOrder("asc");
    }
  };

  const distinctTypes = useMemo(() => {
    const s = new Set<string>();
    for (const r of statsItems) s.add(r.type);
    return [...s].sort();
  }, [statsItems]);

  const overviewCounts = useMemo(() => {
    const total = statsItems.length;
    const byStatus = { active: 0, maintenance: 0, offline: 0 };
    for (const r of statsItems) {
      if (r.status === "maintenance") byStatus.maintenance += 1;
      else if (r.status === "offline") byStatus.offline += 1;
      else byStatus.active += 1;
    }
    return { total, byStatus };
  }, [statsItems]);

  const partsNeedingReplacement = useMemo(() => {
    let n = 0;
    for (const r of statsItems) {
      n += (r.parts_overdue_count ?? 0) + (r.parts_due_soon_count ?? 0);
    }
    return n;
  }, [statsItems]);

  const recent = useMemo(() => {
    return [...statsItems]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [statsItems]);

  if (blocked) {
    return (
      <div className="mx-auto w-full max-w-2xl py-10">
        <PageHeader
          title="Equipment"
          description="Manage and monitor all facility equipment."
          icon={Wrench}
        />
        <Card padding="md" className="mt-6">
          <p className="text-sm text-pulse-muted">
            The equipment module is not enabled for your organization. A system administrator can turn on the{" "}
            <span className="font-semibold text-pulse-navy">equipment</span> feature for your company in System admin →
            Companies.
          </p>
        </Card>
      </div>
    );
  }

  const tabBtn = (id: Tab, label: string, Icon: typeof LayoutGrid) => (
    <button
      key={id}
      type="button"
      onClick={() => {
        if (id === "form") {
          openCreate();
          setTab("form");
          return;
        }
        if (tab === "form") resetForm();
        setTab(id);
      }}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        tab === id ? "bg-sky-50/95 text-[#1e4a8a] ring-1 ring-sky-200/80" : "text-pulse-navy hover:bg-white/80"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Equipment" description="Manage and monitor all facility equipment." icon={Wrench} />

      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <nav
        className="flex flex-wrap gap-1 rounded-xl border border-slate-200/90 bg-white p-1 shadow-sm"
        aria-label="Equipment sections"
      >
        {tabBtn("overview", "Overview", LayoutGrid)}
        {tabBtn("list", "Equipment List", List)}
        {tabBtn("form", formMode === "edit" ? "Edit Equipment" : formMode === "view" ? "Details" : "Add Equipment", Plus)}
      </nav>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      {tab === "overview" && (
        <div className="space-y-6">
          {loading ? (
            <p className="text-sm text-pulse-muted">Loading…</p>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <Card padding="md" className="flex flex-col gap-1">
                  <p className={LABEL}>Total equipment</p>
                  <p className="font-headline text-2xl font-bold tabular-nums text-pulse-navy">{overviewCounts.total}</p>
                </Card>
                <Card padding="md" className="flex flex-col gap-1">
                  <p className={LABEL}>Active</p>
                  <p className="font-headline text-2xl font-bold tabular-nums text-emerald-800">{overviewCounts.byStatus.active}</p>
                </Card>
                <Card padding="md" className="flex flex-col gap-1">
                  <p className={LABEL}>Maintenance</p>
                  <p className="font-headline text-2xl font-bold tabular-nums text-amber-900">
                    {overviewCounts.byStatus.maintenance}
                  </p>
                </Card>
                <Card padding="md" className="flex flex-col gap-1">
                  <p className={LABEL}>Offline</p>
                  <p className="font-headline text-2xl font-bold tabular-nums text-pulse-muted">
                    {overviewCounts.byStatus.offline}
                  </p>
                </Card>
                <Card padding="md" className="flex flex-col gap-1 border-l-4 border-l-amber-500/90">
                  <p className={LABEL}>Parts needing replacement</p>
                  <p className="font-headline text-2xl font-bold tabular-nums text-amber-950">{partsNeedingReplacement}</p>
                  <p className="text-xs text-pulse-muted">Due soon or overdue (all assets)</p>
                </Card>
              </section>

              <div className="flex flex-wrap gap-3">
                {canMutate ? (
                  <button type="button" className={PRIMARY_BTN} onClick={openCreate}>
                    Add equipment
                  </button>
                ) : null}
                <button type="button" className={SECONDARY_BTN} onClick={() => setTab("list")}>
                  View all
                </button>
              </div>

              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-pulse-muted">Recent updates</h2>
                <Card padding="md" className="!p-0 overflow-hidden">
                  {recent.length === 0 ? (
                    <p className="p-4 text-sm text-pulse-muted">
                      No equipment yet. Add your first asset to start tracking maintenance.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {recent.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                          <div>
                            <p className="font-semibold text-pulse-navy">{r.name}</p>
                            <p className="text-xs text-pulse-muted">
                              {r.type} · {formatDate(r.updated_at)}
                            </p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge(r.status)}`}>
                            {r.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </section>
            </>
          )}
        </div>
      )}

      {tab === "list" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-[200px] flex-1">
              <label className={LABEL} htmlFor="eq-search">
                Search
              </label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted" aria-hidden />
                <input
                  id="eq-search"
                  className={`${FIELD} pl-9`}
                  placeholder="Name, type, serial, model…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void loadList()}
                />
              </div>
            </div>
            <div className="w-full min-w-[140px] sm:w-auto">
              <label className={LABEL}>Zone</label>
              <select className={FIELD} value={filterZone} onChange={(e) => setFilterZone(e.target.value)}>
                <option value="">All zones</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full min-w-[140px] sm:w-auto">
              <label className={LABEL}>Type</label>
              <select className={FIELD} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">All types</option>
                {distinctTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full min-w-[140px] sm:w-auto">
              <label className={LABEL}>Status</label>
              <select className={FIELD} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All</option>
                {STATUS_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className={PRIMARY_BTN} onClick={() => void loadList()}>
              Apply filters
            </button>
          </div>

          <Card padding="md" className="!p-0 overflow-x-auto">
            {listLoading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-pulse-muted">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Loading…
              </div>
            ) : items.length === 0 ? (
              <p className="p-8 text-center text-sm text-pulse-muted">
                {search.trim() || filterZone || filterType || filterStatus
                  ? "No equipment matches your filters."
                  : "No equipment yet. Add your first asset to start tracking maintenance."}
              </p>
            ) : (
              <table className="min-w-[720px] w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    {(
                      [
                        ["name", "Name"],
                        ["type", "Type"],
                        ["zone_name", "Zone"],
                        ["status", "Status"],
                        ["last_service_date", "Last service"],
                      ] as const
                    ).map(([col, label]) => (
                      <th key={col} className="px-4 py-3 font-semibold text-pulse-navy">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-[#2B4C7E]"
                          onClick={() => toggleSort(col)}
                        >
                          {label}
                          {sort === col ? (order === "asc" ? " ↑" : " ↓") : ""}
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 font-semibold text-pulse-navy">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr
                      key={r.id}
                      role="link"
                      tabIndex={0}
                      className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/50"
                      onClick={() => router.push(`/equipment/${encodeURIComponent(r.id)}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/equipment/${encodeURIComponent(r.id)}`);
                        }
                      }}
                    >
                      <td className="px-4 py-3 font-medium text-pulse-navy">
                        <span className="inline-flex items-center gap-2">
                          {(r.parts_overdue_count ?? 0) > 0 ? (
                            <span className="inline-flex shrink-0 text-red-600" title="Has overdue parts">
                              <AlertTriangle className="h-4 w-4" aria-hidden />
                            </span>
                          ) : (r.parts_due_soon_count ?? 0) > 0 ? (
                            <span className="inline-flex shrink-0 text-amber-600" title="Has parts due soon">
                              <AlertTriangle className="h-4 w-4" aria-hidden />
                            </span>
                          ) : null}
                          {r.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-pulse-muted">{r.type}</td>
                      <td className="px-4 py-3 text-pulse-muted">{r.zone_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-pulse-muted tabular-nums">{formatDate(r.last_service_date)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-pulse-navy hover:bg-slate-50"
                            onClick={() => void openView(r.id)}
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                            View
                          </button>
                          {canMutate ? (
                            <>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-pulse-navy hover:bg-slate-50"
                                onClick={() => void openEdit(r.id)}
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                                onClick={() => void onDelete(r.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === "form" && (
        <Card padding="md">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold text-pulse-navy hover:bg-slate-50"
                onClick={() => {
                  resetForm();
                  setTab("list");
                }}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to list
              </button>
              <h2 className="font-headline text-lg font-bold text-pulse-navy">
                {formMode === "create" ? "Add equipment" : formMode === "edit" ? "Edit equipment" : "Equipment details"}
              </h2>
            </div>
            {formMode === "view" && canMutate && formId ? (
              <button type="button" className={PRIMARY_BTN} onClick={() => void openEdit(formId)}>
                Edit
              </button>
            ) : null}
          </div>

          {formError ? <p className="mb-4 text-sm font-medium text-red-700">{formError}</p> : null}

          <form onSubmit={onSubmitForm} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="eq-name">
                  Equipment name *
                </label>
                <input
                  id="eq-name"
                  className={FIELD}
                  required
                  disabled={formMode === "view"}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="eq-type">
                  Type / category *
                </label>
                <input
                  id="eq-type"
                  className={FIELD}
                  required
                  disabled={formMode === "view"}
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  list="eq-type-list"
                />
                <datalist id="eq-type-list">
                  {TYPE_SUGGESTIONS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className={LABEL} htmlFor="eq-zone">
                  Zone
                </label>
                <select
                  id="eq-zone"
                  className={FIELD}
                  disabled={formMode === "view"}
                  value={formZoneId}
                  onChange={(e) => setFormZoneId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="eq-status">
                  Status *
                </label>
                <select
                  id="eq-status"
                  className={FIELD}
                  required
                  disabled={formMode === "view"}
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                >
                  {STATUS_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="eq-mfg">
                  Manufacturer
                </label>
                <input
                  id="eq-mfg"
                  className={FIELD}
                  disabled={formMode === "view"}
                  value={formManufacturer}
                  onChange={(e) => setFormManufacturer(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="eq-model">
                  Model
                </label>
                <input
                  id="eq-model"
                  className={FIELD}
                  disabled={formMode === "view"}
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="eq-serial">
                  Serial number
                </label>
                <input
                  id="eq-serial"
                  className={FIELD}
                  disabled={formMode === "view"}
                  value={formSerial}
                  onChange={(e) => setFormSerial(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="eq-install">
                  Installation date
                </label>
                <input
                  id="eq-install"
                  type="date"
                  className={FIELD}
                  disabled={formMode === "view"}
                  value={formInstall}
                  onChange={(e) => setFormInstall(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="eq-svc">
                  Last service date
                </label>
                <input
                  id="eq-svc"
                  type="date"
                  className={FIELD}
                  disabled={formMode === "view"}
                  value={formLastService}
                  onChange={(e) => setFormLastService(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="eq-next-svc">
                  Next service date
                </label>
                <input
                  id="eq-next-svc"
                  type="date"
                  className={FIELD}
                  disabled={formMode === "view"}
                  value={formNextService}
                  onChange={(e) => setFormNextService(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="eq-interval">
                  Service interval (days)
                </label>
                <input
                  id="eq-interval"
                  type="number"
                  min={1}
                  className={FIELD}
                  placeholder="e.g. 90"
                  disabled={formMode === "view"}
                  value={formServiceInterval}
                  onChange={(e) => setFormServiceInterval(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="eq-notes">
                Notes
              </label>
              <textarea
                id="eq-notes"
                className={`${FIELD} min-h-[100px] resize-y`}
                disabled={formMode === "view"}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>

            {formMode !== "view" ? (
              <div className="flex flex-wrap gap-3">
                <button type="submit" className={PRIMARY_BTN} disabled={formSubmitting}>
                  {formSubmitting ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
                <button
                  type="button"
                  className={SECONDARY_BTN}
                  disabled={formSubmitting}
                  onClick={() => {
                    resetForm();
                    setTab("list");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </form>
        </Card>
      )}
    </div>
  );
}
