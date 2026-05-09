"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Plus, Save, X } from "lucide-react";
import { Card } from "@/components/pulse/Card";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  createRoutine,
  getRoutine,
  listRoutines,
  patchRoutine,
  type RoutineDetail,
  type RoutineItemIn,
  type RoutineRow,
  type RoutineShiftBand,
} from "@/lib/routinesService";
import { ROUTINE_SHIFT_TABS } from "@/lib/routines/shiftBands";

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5");
const SECONDARY_BTN = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5");
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-ds-border bg-ds-secondary px-3 py-2.5 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)]";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";

type DraftItem = { key: string; label: string; required: boolean };

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function oneEmptyDraft(): DraftItem {
  return { key: newKey(), label: "", required: true };
}

function emptyBandMap(): Record<RoutineShiftBand, DraftItem[]> {
  return {
    day: [oneEmptyDraft()],
    afternoon: [oneEmptyDraft()],
    night: [oneEmptyDraft()],
  };
}

/** Strip empties; positions assigned in flatten/build. */
function normalizeBandDraft(items: DraftItem[]): Omit<RoutineItemIn, "position" | "shift_band">[] {
  return items
    .map((it) => ({
      label: it.label.trim(),
      required: Boolean(it.required),
    }))
    .filter((it) => it.label);
}

function flattenBandsToPayload(
  bandsInUse: RoutineShiftBand[],
  byBand: Record<RoutineShiftBand, DraftItem[]>,
): RoutineItemIn[] {
  let pos = 0;
  const out: RoutineItemIn[] = [];
  for (const band of bandsInUse) {
    for (const it of normalizeBandDraft(byBand[band] ?? [])) {
      out.push({ ...it, position: pos++, shift_band: band });
    }
  }
  return out;
}

const UNIVERSAL_TAB = "universal" as const;
type EditTabId = typeof UNIVERSAL_TAB | RoutineShiftBand;

export function RoutinesApp() {
  const [rows, setRows] = useState<RoutineRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<RoutineDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /** Create: name step → shift checklist steps */
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<"name" | "shifts">("name");
  const [createName, setCreateName] = useState("");
  const [createBands, setCreateBands] = useState<RoutineShiftBand[]>(["day"]);
  const [createActiveBand, setCreateActiveBand] = useState<RoutineShiftBand>("day");
  const [createByBand, setCreateByBand] = useState<Record<RoutineShiftBand, DraftItem[]>>(emptyBandMap);

  const [editName, setEditName] = useState("");
  const [editTab, setEditTab] = useState<EditTabId>("day");
  const [editUniversal, setEditUniversal] = useState<DraftItem[]>([]);
  const [editByBand, setEditByBand] = useState<Record<RoutineShiftBand, DraftItem[]>>(emptyBandMap);

  const canSaveCreateName = useMemo(() => createName.trim().length > 0, [createName]);
  const canCompleteCreate = useMemo(() => {
    if (!createName.trim()) return false;
    return createBands.some((b) => normalizeBandDraft(createByBand[b] ?? []).length > 0);
  }, [createName, createBands, createByBand]);

  const canSaveEdit = useMemo(() => editName.trim().length > 0 && Boolean(selectedId), [editName, selectedId]);

  const editHasUniversal = useMemo(
    () =>
      (selected?.items ?? []).some((i) => {
        const sb = i.shift_band;
        return sb == null || String(sb).trim() === "";
      }),
    [selected],
  );

  const editTabs = useMemo(() => {
    const tabs: { id: EditTabId; label: string }[] = [];
    if (editHasUniversal) tabs.push({ id: UNIVERSAL_TAB, label: "All shifts" });
    for (const t of ROUTINE_SHIFT_TABS) tabs.push(t);
    return tabs;
  }, [editHasUniversal]);

  async function reload() {
    try {
      const list = await listRoutines();
      setRows(list);
      setErr(null);
    } catch (e) {
      const { message } = parseClientApiError(e);
      setErr(message || "Could not load routines.");
      setRows([]);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  function resetCreateWizard() {
    setCreateStep("name");
    setCreateName("");
    setCreateBands(["day"]);
    setCreateActiveBand("day");
    setCreateByBand(emptyBandMap());
  }

  function openCreate() {
    resetCreateWizard();
    setCreateOpen(true);
  }

  function splitDetailIntoEditState(d: RoutineDetail) {
    const u: DraftItem[] = [];
    const by: Record<RoutineShiftBand, DraftItem[]> = {
      day: [],
      afternoon: [],
      night: [],
    };
    for (const it of d.items ?? []) {
      const row: DraftItem = {
        key: it.id ? `id:${it.id}` : newKey(),
        label: it.label ?? "",
        required: it.required !== false,
      };
      const sb = it.shift_band as RoutineShiftBand | null | undefined;
      if (!sb || (sb !== "day" && sb !== "afternoon" && sb !== "night")) {
        u.push(row);
      } else {
        by[sb].push(row);
      }
    }
    for (const b of ROUTINE_SHIFT_TABS) {
      if ((by[b.id].length ?? 0) === 0) by[b.id] = [oneEmptyDraft()];
      else by[b.id] = by[b.id].map((r) => ({ ...r, key: r.key || newKey() }));
    }
    const hasUniversal = u.length > 0;
    setEditUniversal(hasUniversal ? u : []);
    setEditByBand(by);
    setEditTab(hasUniversal ? UNIVERSAL_TAB : "day");
  }

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      setEditName("");
      setEditUniversal([]);
      setEditByBand(emptyBandMap());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await getRoutine(selectedId);
        if (cancelled) return;
        setSelected(d);
        setEditName(d.name ?? "");
        splitDetailIntoEditState(d);
      } catch (e) {
        if (!cancelled) {
          const { message } = parseClientApiError(e);
          setToast(message || "Could not load routine.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function submitCreate() {
    if (!canCompleteCreate || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const items = flattenBandsToPayload(createBands, createByBand);
      const out = await createRoutine({
        name: createName.trim(),
        items,
      });
      setToast("Routine created.");
      setCreateOpen(false);
      resetCreateWizard();
      await reload();
      setSelectedId(out.id);
    } catch (e) {
      const { message } = parseClientApiError(e);
      setErr(message || "Could not create routine.");
    } finally {
      setBusy(false);
    }
  }

  function buildEditPayload(): RoutineItemIn[] {
    let pos = 0;
    const out: RoutineItemIn[] = [];
    for (const it of normalizeBandDraft(editUniversal)) {
      out.push({ ...it, position: pos++, shift_band: null });
    }
    for (const band of ROUTINE_SHIFT_TABS) {
      for (const it of normalizeBandDraft(editByBand[band.id] ?? [])) {
        out.push({ ...it, position: pos++, shift_band: band.id });
      }
    }
    return out;
  }

  async function submitEdit() {
    if (!selectedId || !canSaveEdit || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await patchRoutine(selectedId, {
        name: editName.trim(),
        items: buildEditPayload(),
      });
      setToast("Routine saved.");
      await reload();
      const d = await getRoutine(selectedId);
      setSelected(d);
    } catch (e) {
      const { message } = parseClientApiError(e);
      setErr(message || "Could not save routine.");
    } finally {
      setBusy(false);
    }
  }

  const addCreateShiftBand = (band: RoutineShiftBand) => {
    if (createBands.includes(band)) {
      setCreateActiveBand(band);
      return;
    }
    setCreateBands((prev) => [...prev, band]);
    setCreateByBand((prev) => ({
      ...prev,
      [band]: prev[band]?.length ? prev[band]! : [oneEmptyDraft()],
    }));
    setCreateActiveBand(band);
  };

  const createBandsAvailableToAdd = ROUTINE_SHIFT_TABS.filter((t) => !createBands.includes(t.id)).map((t) => t.id);

  const currentCreateDrafts =
    createActiveBand && createByBand[createActiveBand] ? createByBand[createActiveBand]! : [oneEmptyDraft()];

  const setDraftsForActiveCreate = (fn: (prev: DraftItem[]) => DraftItem[]) => {
    setCreateByBand((prev) => ({
      ...prev,
      [createActiveBand]: fn(prev[createActiveBand] ?? [oneEmptyDraft()]),
    }));
  };

  const editDraftList =
    editTab === UNIVERSAL_TAB ? editUniversal : editByBand[editTab as RoutineShiftBand] ?? [oneEmptyDraft()];

  const setEditDraftList = (fn: (prev: DraftItem[]) => DraftItem[]) => {
    if (editTab === UNIVERSAL_TAB) {
      setEditUniversal(fn);
    } else {
      setEditByBand((prev) => ({
        ...prev,
        [editTab]: fn(prev[editTab as RoutineShiftBand] ?? [oneEmptyDraft()]),
      }));
    }
  };

  if (rows === null) {
    return (
      <div className="flex min-h-[28vh] items-center justify-center text-sm text-ds-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Loading routines…
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg dark:border-emerald-500/35 dark:bg-emerald-950/95 dark:text-emerald-100"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <div className="lg:col-span-4">
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-ds-foreground">Routines</p>
            <button type="button" className={PRIMARY_BTN} onClick={() => openCreate()} disabled={busy}>
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" aria-hidden />
                Create
              </span>
            </button>
          </div>

          {err ? (
            <div className="rounded-xl border border-ds-border bg-ds-primary px-4 py-3 text-sm font-medium text-ds-danger shadow-sm">
              {err}
            </div>
          ) : null}

          {rows.length === 0 ? (
            <p className="text-sm text-ds-muted">No routines yet.</p>
          ) : (
            <ul className="space-y-1">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                      selectedId === r.id
                        ? "border-[color-mix(in_srgb,var(--ds-success)_35%,var(--ds-border))] bg-ds-interactive-hover text-ds-foreground"
                        : "border-ds-border bg-ds-secondary text-ds-foreground hover:bg-ds-interactive-hover"
                    }`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="lg:col-span-8">
        {createOpen ? (
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ds-foreground">
                {createStep === "name" ? "Create routine" : "Checklists by shift"}
              </p>
              <button
                type="button"
                className={SECONDARY_BTN}
                onClick={() => {
                  setCreateOpen(false);
                  resetCreateWizard();
                }}
                disabled={busy}
              >
                <span className="inline-flex items-center gap-2">
                  <X className="h-4 w-4" aria-hidden />
                  Close
                </span>
              </button>
            </div>

            {createStep === "name" ? (
              <>
                <p className="text-sm text-ds-muted">
                  Name the routine first. On the next step you&apos;ll pick a shift (Days, Afternoons, or Nights), add
                  checklist lines, and optionally add more shifts before finishing.
                </p>
                <div>
                  <label className={LABEL} htmlFor="rt-name">
                    Routine name
                  </label>
                  <input
                    id="rt-name"
                    className={FIELD}
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className={PRIMARY_BTN}
                    onClick={() => setCreateStep("shifts")}
                    disabled={busy || !canSaveCreateName}
                  >
                    <span className="inline-flex items-center gap-2">
                      Continue
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="rounded-lg border border-ds-border bg-ds-secondary/50 px-3 py-2 text-sm text-ds-foreground">
                  <span className="font-semibold">{createName.trim() || "Untitled"}</span>
                  <span className="text-ds-muted"> — add items per shift. Universal lines can be added later when editing.</span>
                </p>

                <div className="flex flex-wrap gap-1 rounded-lg border border-ds-border bg-ds-secondary/40 p-1">
                  {createBands.map((b) => {
                    const label = ROUTINE_SHIFT_TABS.find((t) => t.id === b)?.label ?? b;
                    const active = createActiveBand === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setCreateActiveBand(b)}
                        className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                          active
                            ? "bg-ds-success text-ds-on-accent shadow-sm"
                            : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <p className={LABEL}>Checklist items ({ROUTINE_SHIFT_TABS.find((t) => t.id === createActiveBand)?.label})</p>
                  <div className="mt-2 space-y-2">
                    {currentCreateDrafts.map((it, idx) => (
                      <div key={it.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-ds-border bg-ds-secondary p-3">
                        <input
                          className={cn(FIELD, "mt-0 flex-1 bg-ds-primary")}
                          value={it.label}
                          onChange={(e) =>
                            setDraftsForActiveCreate((prev) =>
                              prev.map((x) => (x.key === it.key ? { ...x, label: e.target.value } : x)),
                            )
                          }
                          placeholder={`Item ${idx + 1}`}
                        />
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-ds-foreground">
                          <input
                            type="checkbox"
                            checked={it.required}
                            onChange={(e) =>
                              setDraftsForActiveCreate((prev) =>
                                prev.map((x) => (x.key === it.key ? { ...x, required: e.target.checked } : x)),
                              )
                            }
                          />
                          Required
                        </label>
                        <button
                          type="button"
                          className={SECONDARY_BTN}
                          onClick={() =>
                            setDraftsForActiveCreate((prev) =>
                              prev.length <= 1 ? prev : prev.filter((x) => x.key !== it.key),
                            )
                          }
                          disabled={busy || currentCreateDrafts.length <= 1}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={SECONDARY_BTN + " mt-3"}
                    onClick={() => setDraftsForActiveCreate((prev) => [...prev, oneEmptyDraft()])}
                    disabled={busy}
                  >
                    Add item
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-ds-border pt-4">
                  <p className="w-full text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Add another shift</p>
                  {createBandsAvailableToAdd.length === 0 ? (
                    <p className="text-xs text-ds-muted">All shift bands are in this routine.</p>
                  ) : (
                    createBandsAvailableToAdd.map((b) => (
                      <button
                        key={b}
                        type="button"
                        className={SECONDARY_BTN}
                        onClick={() => addCreateShiftBand(b)}
                        disabled={busy}
                      >
                        + {ROUTINE_SHIFT_TABS.find((t) => t.id === b)?.label}
                      </button>
                    ))
                  )}
                </div>

                <div className="flex flex-wrap justify-between gap-2 pt-2">
                  <button type="button" className={SECONDARY_BTN} onClick={() => setCreateStep("name")} disabled={busy}>
                    Back
                  </button>
                  <button type="button" className={PRIMARY_BTN} onClick={() => void submitCreate()} disabled={busy || !canCompleteCreate}>
                    <span className="inline-flex items-center gap-2">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                      {busy ? "Saving…" : "Complete routine"}
                    </span>
                  </button>
                </div>
              </>
            )}
          </Card>
        ) : selected ? (
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ds-foreground">Edit routine</p>
              <div className="text-xs font-medium text-ds-muted">
                {(selected.items?.length ?? 0) === 0 ? "No lines yet" : `${selected.items?.length} line(s)`}
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="rt-edit-name">
                Name
              </label>
              <input id="rt-edit-name" className={FIELD} value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg border border-ds-border bg-ds-secondary/40 p-1">
              {editTabs.map((t) => {
                const active = editTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEditTab(t.id)}
                    className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "bg-ds-success text-ds-on-accent shadow-sm"
                        : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div>
              <p className={LABEL}>
                Checklist items
                {editTab === UNIVERSAL_TAB ? (
                  <span className="ml-2 font-normal normal-case text-ds-muted">(shown for every shift)</span>
                ) : null}
              </p>
              <div className="mt-2 space-y-2">
                {editDraftList.map((it, idx) => (
                  <div key={it.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-ds-border bg-ds-secondary p-3">
                    <input
                      className={cn(FIELD, "mt-0 flex-1 bg-ds-primary")}
                      value={it.label}
                      onChange={(e) =>
                        setEditDraftList((prev) => prev.map((x) => (x.key === it.key ? { ...x, label: e.target.value } : x)))
                      }
                      placeholder={`Item ${idx + 1}`}
                    />
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-ds-foreground">
                      <input
                        type="checkbox"
                        checked={it.required}
                        onChange={(e) =>
                          setEditDraftList((prev) => prev.map((x) => (x.key === it.key ? { ...x, required: e.target.checked } : x)))
                        }
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      className={SECONDARY_BTN}
                      onClick={() =>
                        setEditDraftList((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.key !== it.key)))
                      }
                      disabled={busy || editDraftList.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={SECONDARY_BTN + " mt-3"}
                onClick={() => setEditDraftList((prev) => [...prev, oneEmptyDraft()])}
                disabled={busy}
              >
                Add item
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={PRIMARY_BTN} onClick={() => void submitEdit()} disabled={busy || !canSaveEdit}>
                <span className="inline-flex items-center gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                  {busy ? "Saving…" : "Save changes"}
                </span>
              </button>
            </div>
          </Card>
        ) : (
          <Card padding="md" className="border-dashed border-slate-200/90 dark:border-ds-border">
            <p className="text-sm font-semibold text-ds-foreground">Select a routine</p>
            <p className="mt-1 text-sm text-ds-muted">
              Create a template with per-shift checklists, then run it from the schedule.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
