"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createProcedure,
  fetchProcedures,
  patchProcedure,
  type ProcedureRow,
} from "@/lib/cmmsApi";
import { parseClientApiError } from "@/lib/parse-client-api-error";

function stepsToText(steps: string[]): string {
  return steps.join("\n");
}

function textToSteps(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ProceduresMaintenanceApp() {
  const [rows, setRows] = useState<ProcedureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStepsText, setEditStepsText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchProcedures();
      setRows(list);
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!selected) {
      setEditTitle("");
      setEditStepsText("");
      return;
    }
    setEditTitle(selected.title);
    setEditStepsText(stepsToText(selected.steps));
  }, [selected]);

  const create = async () => {
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    setErr(null);
    try {
      await createProcedure({ title: t, steps: textToSteps(stepsText) });
      setTitle("");
      setStepsText("");
      await load();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!selectedId) return;
    const t = editTitle.trim();
    if (!t) return;
    setSaving(true);
    setErr(null);
    try {
      await patchProcedure(selectedId, { title: t, steps: textToSteps(editStepsText) });
      await load();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-md border border-pulse-border bg-white p-4 shadow-card dark:border-slate-700 dark:bg-ds-bg/65">
        <h2 className="text-sm font-semibold text-pulse-navy dark:text-slate-100">New procedure</h2>
        <p className="mt-1 text-xs text-pulse-muted">Steps are one per line; they are stored as a reusable list.</p>
        <div className="mt-3 space-y-2">
          <input
            className="w-full rounded-lg border border-pulse-border px-3 py-2 text-sm dark:border-slate-600 dark:bg-ds-secondary"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="min-h-[8rem] w-full rounded-lg border border-pulse-border px-3 py-2 text-sm dark:border-slate-600 dark:bg-ds-secondary"
            placeholder="Step 1&#10;Step 2&#10;…"
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
          />
          <button
            type="button"
            disabled={saving || !title.trim()}
            onClick={() => void create()}
            className="rounded-lg bg-pulse-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </section>

      <div className="space-y-4">
        {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}

        <section className="rounded-md border border-pulse-border bg-white p-4 shadow-card dark:border-slate-700 dark:bg-ds-bg/65">
          <h2 className="text-sm font-semibold text-pulse-navy dark:text-slate-100">Library</h2>
          {loading ? (
            <p className="mt-2 text-sm text-pulse-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="mt-2 text-sm text-pulse-muted">No procedures yet.</p>
          ) : (
            <ul className="mt-3 max-h-[min(50vh,24rem)] divide-y divide-pulse-border overflow-auto dark:divide-slate-700">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`flex w-full items-start justify-between gap-2 px-2 py-2 text-left text-sm transition-colors ${
                      selectedId === r.id
                        ? "bg-pulse-accent/10 text-pulse-navy dark:bg-ds-secondary dark:text-slate-100"
                        : "hover:bg-slate-50 dark:hover:bg-ds-interactive-hover"
                    }`}
                  >
                    <span className="font-medium">{r.title}</span>
                    <span className="shrink-0 text-xs text-pulse-muted">{r.steps.length} steps</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected ? (
          <section className="rounded-md border border-pulse-border bg-white p-4 shadow-card dark:border-slate-700 dark:bg-ds-bg/65">
            <h2 className="text-sm font-semibold text-pulse-navy dark:text-slate-100">Edit</h2>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border border-pulse-border px-3 py-2 text-sm dark:border-slate-600 dark:bg-ds-secondary"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <textarea
                className="min-h-[10rem] w-full rounded-lg border border-pulse-border px-3 py-2 text-sm dark:border-slate-600 dark:bg-ds-secondary"
                value={editStepsText}
                onChange={(e) => setEditStepsText(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || !editTitle.trim()}
                  onClick={() => void saveEdit()}
                  className="rounded-lg bg-pulse-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg border border-pulse-border px-3 py-2 text-sm font-semibold dark:border-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
