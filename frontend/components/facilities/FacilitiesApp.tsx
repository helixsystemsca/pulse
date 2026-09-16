"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, ChevronLeft, Loader2, Package, Plus, Search, Trash2, Wrench } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import { HintCallout } from "@/components/ui/HintCallout";
import { useAsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { hasRbacPermission } from "@/lib/rbac/session-access";
import { isUserFeatureEnabled } from "@/lib/features/tenant-features";
import { readSession } from "@/lib/pulse-session";
import {
  createOpsRecord,
  deleteOpsRecord,
  fetchFacilityContents,
  listOpsRecords,
  patchOpsRecord,
  type FacilityContents,
  type OpsRecord,
} from "@/lib/recreation/opsService";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { uiCalloutWarning } from "@/styles/ui-classes";

const FIELD = "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2.5 text-sm text-ds-foreground disabled:opacity-60";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5");

type FormState = {
  title: string;
  status: string;
  description: string;
  building_info: string;
  mechanical_systems: string;
  emergency_procedures: string;
  notes: string;
};

const EMPTY: FormState = {
  title: "",
  status: "active",
  description: "",
  building_info: "",
  mechanical_systems: "",
  emergency_procedures: "",
  notes: "",
};

function fromRow(row: OpsRecord): FormState {
  return {
    title: row.title ?? "",
    status: row.status || "active",
    description: typeof row.description === "string" ? row.description : "",
    building_info: typeof row.building_info === "string" ? row.building_info : "",
    mechanical_systems: typeof row.mechanical_systems === "string" ? row.mechanical_systems : "",
    emergency_procedures: typeof row.emergency_procedures === "string" ? row.emergency_procedures : "",
    notes: typeof row.notes === "string" ? row.notes : "",
  };
}

export function FacilitiesApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = readSession();
  const canView =
    isUserFeatureEnabled(session, "recreation_ops") &&
    (hasRbacPermission(session, "recreation_ops.view") || hasRbacPermission(session, "recreation_ops.manage"));
  const canEdit = isUserFeatureEnabled(session, "recreation_ops") && hasRbacPermission(session, "recreation_ops.manage");
  const canEquipment = isUserFeatureEnabled(session, "equipment");
  const canInventory = isUserFeatureEnabled(session, "inventory");

  const focusId = searchParams.get("id");
  const createParam = searchParams.get("create") === "1";
  const qParam = searchParams.get("q") ?? "";

  const [rows, setRows] = useState<OpsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(qParam);
  const [qDebounced, setQDebounced] = useState(qParam);
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [creating, setCreating] = useState(createParam);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [moreOpen, setMoreOpen] = useState(false);
  const [contents, setContents] = useState<FacilityContents | null>(null);
  const [contentsLoading, setContentsLoading] = useState(false);
  const { phase, run } = useAsyncSubmitPhase();

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listOpsRecords("facilities", { q: qDebounced.trim() || undefined });
      setRows(list);
    } catch (e) {
      setError(parseClientApiError(e).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [qDebounced]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (qParam) setQ(qParam);
  }, [qParam]);

  useEffect(() => {
    if (createParam) {
      setCreating(true);
      setSelectedId(null);
      setForm(EMPTY);
    }
  }, [createParam]);

  useEffect(() => {
    if (focusId && rows.some((r) => r.id === focusId)) {
      setSelectedId(focusId);
      setCreating(false);
    }
  }, [focusId, rows]);

  useEffect(() => {
    if (creating || !selectedId) {
      setContents(null);
      return;
    }
    setContentsLoading(true);
    void fetchFacilityContents(selectedId)
      .then(setContents)
      .catch(() => setContents(null))
      .finally(() => setContentsLoading(false));
  }, [creating, selectedId]);

  function openCreate() {
    setCreating(true);
    setSelectedId(null);
    setForm(EMPTY);
    setMoreOpen(false);
    router.replace("/recreation/facilities?create=1", { scroll: false });
  }

  function openEdit(row: OpsRecord) {
    setCreating(false);
    setSelectedId(row.id);
    setForm(fromRow(row));
    setMoreOpen(Boolean(row.building_info || row.mechanical_systems || row.emergency_procedures || row.notes));
    router.replace(`/recreation/facilities?id=${encodeURIComponent(row.id)}`, { scroll: false });
  }

  function closePanel() {
    setCreating(false);
    setSelectedId(null);
    setForm(EMPTY);
    router.replace("/recreation/facilities", { scroll: false });
  }

  async function save() {
    if (!form.title.trim()) return;
    await run(async () => {
      const payload = {
        title: form.title.trim(),
        status: form.status,
        description: form.description.trim() || null,
        building_info: form.building_info.trim() || null,
        mechanical_systems: form.mechanical_systems.trim() || null,
        emergency_procedures: form.emergency_procedures.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (creating) {
        const created = await createOpsRecord("facilities", payload);
        setCreating(false);
        setSelectedId(created.id);
        router.replace(`/recreation/facilities?id=${encodeURIComponent(created.id)}`, { scroll: false });
      } else if (selectedId) {
        await patchOpsRecord("facilities", selectedId, payload);
      }
      await refresh();
    });
  }

  async function remove() {
    if (!selectedId || !confirm("Delete this facility? Linked assets and inventory stay, but lose this facility link.")) {
      return;
    }
    await deleteOpsRecord("facilities", selectedId);
    closePanel();
    await refresh();
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-ds-border bg-ds-secondary/30 p-8 text-center">
        <Building2 className="mx-auto h-10 w-10 text-ds-muted" />
        <h1 className="mt-4 text-lg font-semibold text-ds-foreground">Facilities</h1>
        <p className="mt-2 text-sm text-ds-muted">
          Enable <strong>My Role</strong> on the tenant contract to add buildings like the Arena or Aquatic Centre.
        </p>
      </div>
    );
  }

  const showPanel = creating || Boolean(selected);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facilities"
        description="Add each building once. Inventory and equipment can then link to it, and you can open a facility to see what it has."
        icon={Building2}
        actions={
          canEdit ? (
            <button type="button" onClick={openCreate} className={PRIMARY} data-tour="facilities-tour-create">
              <Plus className="mr-1.5 inline h-4 w-4" />
              Add facility
            </button>
          ) : null
        }
      />

      <PageBody>
        {error ? <div className={cn(uiCalloutWarning, "mb-4")}>{error}</div> : null}

        <div className="mb-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
            <input
              className="w-full rounded-lg border border-ds-border bg-ds-bg py-2.5 pl-9 pr-3 text-sm"
              placeholder="Search facilities…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-tour="facilities-tour-search"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
          <div
            className={cn("rounded-xl border border-ds-border bg-ds-card overflow-hidden", showPanel && "hidden lg:block")}
            data-tour="facilities-tour-list"
          >
            {loading ? (
              <div className="flex items-center gap-2 p-6 text-sm text-ds-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <div className="space-y-4 p-6 text-center sm:p-10">
                <Building2 className="mx-auto h-10 w-10 text-ds-muted" />
                <div>
                  <p className="font-semibold text-ds-foreground">No facilities yet</p>
                  <p className="mt-1 text-sm text-ds-muted">
                    Add Arena, Aquatic Centre, or any building you operate. Takes under a minute — just a name.
                  </p>
                </div>
                {canEdit ? (
                  <button type="button" onClick={openCreate} className={PRIMARY}>
                    <Plus className="mr-1.5 inline h-4 w-4" />
                    Add your first facility
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-ds-border">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className={cn(
                        "w-full px-4 py-3.5 text-left hover:bg-ds-muted/10",
                        selectedId === row.id && "bg-ds-primary/5",
                      )}
                    >
                      <p className="truncate font-medium text-ds-foreground">{row.title}</p>
                      <p className="mt-0.5 text-xs capitalize text-ds-muted">{row.status}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className={cn("rounded-xl border border-ds-border bg-ds-card p-4", !showPanel && "hidden lg:block")}
            data-tour="facilities-tour-detail"
          >
            {!showPanel ? (
              <p className="text-sm text-ds-muted">Select a facility or add a new one.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={closePanel}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-ds-primary"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    All facilities
                  </button>
                </div>
                <h3 className="text-sm font-semibold text-ds-foreground">
                  {creating ? "New facility" : "Edit facility"}
                </h3>
                {creating ? (
                  <HintCallout>Name is enough. You can add notes and systems later.</HintCallout>
                ) : null}
                <label className="block space-y-1">
                  <span className={LABEL}>Facility name *</span>
                  <input
                    className={FIELD}
                    value={form.title}
                    disabled={!canEdit}
                    placeholder="e.g. Civic Arena"
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={LABEL}>Status</span>
                  <select
                    className={FIELD}
                    value={form.status}
                    disabled={!canEdit}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className={LABEL}>Description</span>
                  <textarea
                    className={cn(FIELD, "min-h-[72px]")}
                    value={form.description}
                    disabled={!canEdit}
                    placeholder="Optional — rink, pool, parks shop…"
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs font-semibold text-ds-primary hover:underline"
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  {moreOpen ? "Hide extra details" : "More details (systems, emergency)"}
                </button>
                {moreOpen ? (
                  <div className="space-y-3">
                    {(
                      [
                        ["building_info", "Building information"],
                        ["mechanical_systems", "Mechanical systems"],
                        ["emergency_procedures", "Emergency procedures"],
                        ["notes", "Notes"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="block space-y-1">
                        <span className={LABEL}>{label}</span>
                        <textarea
                          className={cn(FIELD, "min-h-[72px]")}
                          value={form[key]}
                          disabled={!canEdit}
                          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        />
                      </label>
                    ))}
                  </div>
                ) : null}

                {canEdit ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <AsyncSubmitButton phase={phase} onClick={() => void save()} idleLabel="Save" />
                    {!creating && selectedId ? (
                      <button
                        type="button"
                        onClick={() => void remove()}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {!creating && selectedId ? (
                  <div className="mt-4 space-y-3 border-t border-ds-border pt-4" data-tour="facilities-tour-contents">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">
                      What this facility has
                    </p>
                    {contentsLoading ? (
                      <p className="text-sm text-ds-muted">Loading linked records…</p>
                    ) : (
                      <>
                        <section>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="inline-flex items-center gap-1 text-xs font-semibold text-ds-foreground">
                              <Wrench className="h-3.5 w-3.5" /> Assets
                            </p>
                            {canEquipment ? (
                              <Link
                                href={`/equipment?create=1&ops_facility_id=${encodeURIComponent(selectedId)}`}
                                className="text-xs font-semibold text-ds-primary hover:underline"
                                data-tour="facilities-tour-add-asset"
                              >
                                Add asset
                              </Link>
                            ) : null}
                          </div>
                          {(contents?.assets.length ?? 0) === 0 ? (
                            <p className="text-xs text-ds-muted">No equipment linked yet.</p>
                          ) : (
                            <ul className="space-y-1 text-sm">
                              {(contents?.assets ?? []).map((a) => (
                                <li key={a.id}>
                                  <Link href={`/equipment/${encodeURIComponent(a.id)}`} className="hover:underline">
                                    {a.name}
                                  </Link>
                                  <span className="text-xs text-ds-muted">
                                    {" "}
                                    · {a.type}
                                    {a.parent_equipment_name ? ` · under ${a.parent_equipment_name}` : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                        <section>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="inline-flex items-center gap-1 text-xs font-semibold text-ds-foreground">
                              <Package className="h-3.5 w-3.5" /> Inventory
                            </p>
                            {canInventory ? (
                              <Link
                                href={`/dashboard/inventory?create=1&ops_facility_id=${encodeURIComponent(selectedId)}`}
                                className="text-xs font-semibold text-ds-primary hover:underline"
                              >
                                Add inventory
                              </Link>
                            ) : null}
                          </div>
                          {(contents?.inventory.length ?? 0) === 0 ? (
                            <p className="text-xs text-ds-muted">No inventory linked yet.</p>
                          ) : (
                            <ul className="space-y-1 text-sm">
                              {(contents?.inventory ?? []).map((it) => (
                                <li key={it.id}>
                                  <span className="font-medium">{it.name}</span>
                                  <span className="text-xs text-ds-muted">
                                    {" "}
                                    · {it.quantity} {it.unit}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </PageBody>
    </div>
  );
}
