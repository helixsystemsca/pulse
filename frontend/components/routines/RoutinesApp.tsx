"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, X } from "lucide-react";
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
} from "@/lib/routinesService";

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5");
const SECONDARY_BTN = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5");
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-ds-border bg-ds-secondary px-3 py-2.5 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)]";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";

type DraftItem = { key: string; label: string; required: boolean };

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeItems(items: DraftItem[]): RoutineItemIn[] {
  return items
    .map((it, idx) => ({
      label: it.label.trim(),
      required: Boolean(it.required),
      position: idx,
    }))
    .filter((it) => it.label);
}

export function RoutinesApp() {
  const [rows, setRows] = useState<RoutineRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<RoutineDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ key: newKey(), label: "", required: true }]);

  const [editName, setEditName] = useState("");
  const [editItems, setEditItems] = useState<DraftItem[]>([]);

  const canSaveCreate = useMemo(() => name.trim().length > 0, [name]);
  const canSaveEdit = useMemo(() => editName.trim().length > 0 && Boolean(selectedId), [editName, selectedId]);

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

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      setEditName("");
      setEditItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await getRoutine(selectedId);
        if (cancelled) return;
        setSelected(d);
        setEditName(d.name ?? "");
        setEditItems(
          (d.items ?? [])
            .slice()
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((it) => ({ key: newKey(), label: it.label ?? "", required: it.required !== false })),
        );
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
    if (!canSaveCreate || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const out = await createRoutine({
        name: name.trim(),
        items: normalizeItems(items),
      });
      setToast("Routine created.");
      setCreateOpen(false);
      setName("");
      setItems([{ key: newKey(), label: "", required: true }]);
      await reload();
      setSelectedId(out.id);
    } catch (e) {
      const { message } = parseClientApiError(e);
      setErr(message || "Could not create routine.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    if (!selectedId || !canSaveEdit || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await patchRoutine(selectedId, {
        name: editName.trim(),
        items: normalizeItems(editItems),
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
            <button type="button" className={PRIMARY_BTN} onClick={() => setCreateOpen(true)} disabled={busy}>
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
              <p className="text-sm font-bold text-ds-foreground">Create routine</p>
              <button type="button" className={SECONDARY_BTN} onClick={() => setCreateOpen(false)} disabled={busy}>
                <span className="inline-flex items-center gap-2">
                  <X className="h-4 w-4" aria-hidden />
                  Close
                </span>
              </button>
            </div>
            <div>
              <label className={LABEL} htmlFor="rt-name">
                Name
              </label>
              <input id="rt-name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <p className={LABEL}>Checklist items</p>
              <div className="mt-2 space-y-2">
                {items.map((it, idx) => (
                  <div key={it.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-ds-border bg-ds-secondary p-3">
                    <input
                      className={cn(FIELD, "mt-0 flex-1 bg-ds-primary")}
                      value={it.label}
                      onChange={(e) =>
                        setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, label: e.target.value } : x)))
                      }
                      placeholder={`Item ${idx + 1}`}
                    />
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-ds-foreground">
                      <input
                        type="checkbox"
                        checked={it.required}
                        onChange={(e) =>
                          setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, required: e.target.checked } : x)))
                        }
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      className={SECONDARY_BTN}
                      onClick={() => setItems((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.key !== it.key)))}
                      disabled={busy || items.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={SECONDARY_BTN + " mt-3"}
                onClick={() => setItems((prev) => [...prev, { key: newKey(), label: "", required: true }])}
                disabled={busy}
              >
                Add item
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={PRIMARY_BTN} onClick={() => void submitCreate()} disabled={busy || !canSaveCreate}>
                <span className="inline-flex items-center gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                  {busy ? "Saving…" : "Create routine"}
                </span>
              </button>
            </div>
          </Card>
        ) : selected ? (
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ds-foreground">Edit routine</p>
              <div className="text-xs font-medium text-ds-muted">
                {selected.items?.length ?? 0} item{(selected.items?.length ?? 0) === 1 ? "" : "s"}
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="rt-edit-name">
                Name
              </label>
              <input id="rt-edit-name" className={FIELD} value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <p className={LABEL}>Checklist items</p>
              <div className="mt-2 space-y-2">
                {editItems.map((it, idx) => (
                  <div key={it.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-ds-border bg-ds-secondary p-3">
                    <input
                      className={cn(FIELD, "mt-0 flex-1 bg-ds-primary")}
                      value={it.label}
                      onChange={(e) =>
                        setEditItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, label: e.target.value } : x)))
                      }
                      placeholder={`Item ${idx + 1}`}
                    />
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-ds-foreground">
                      <input
                        type="checkbox"
                        checked={it.required}
                        onChange={(e) =>
                          setEditItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, required: e.target.checked } : x)))
                        }
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      className={SECONDARY_BTN}
                      onClick={() => setEditItems((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.key !== it.key)))}
                      disabled={busy || editItems.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={SECONDARY_BTN + " mt-3"}
                onClick={() => setEditItems((prev) => [...prev, { key: newKey(), label: "", required: true }])}
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
            <p className="mt-1 text-sm text-ds-muted">Create a routine template, then run it as a checklist.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

