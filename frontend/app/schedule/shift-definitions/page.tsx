"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";

type ShiftDefinition = {
  id: string;
  company_id: string;
  code: string;
  name?: string | null;
  start_min: number;
  end_min: number;
  shift_type: string;
  color?: string | null;
  cert_requirements?: unknown[];
  created_at: string;
  updated_at: string;
};

const FIELD =
  "w-full rounded-md border border-pulseShell-border bg-pulseShell-surface px-3 py-2 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ds-primary/40";

function hhmmFromMin(m: number): string {
  const mm = Math.max(0, Math.min(1439, Math.floor(m)));
  const h = String(Math.floor(mm / 60)).padStart(2, "0");
  const r = String(mm % 60).padStart(2, "0");
  return `${h}:${r}`;
}

function minFromHhmm(s: string): number {
  const [h, m] = (s || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

export default function ShiftDefinitionsPage() {
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<ShiftDefinition[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    id: "" as string | "",
    code: "",
    name: "",
    start: "08:00",
    end: "16:00",
    shift_type: "day",
    color: "",
  });

  useEffect(() => {
    if (!readSession()) {
      navigateToPulseLogin();
      return;
    }
    setReady(true);
  }, []);

  async function load() {
    setErr(null);
    const r = await apiFetch<ShiftDefinition[]>("/api/v1/pulse/schedule/shift-definitions");
    setRows(r);
  }

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready]);

  const editing = useMemo(() => Boolean(draft.id), [draft.id]);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        code: draft.code.trim(),
        name: draft.name.trim() || null,
        start_min: minFromHhmm(draft.start),
        end_min: minFromHhmm(draft.end),
        shift_type: draft.shift_type.trim() || "day",
        color: draft.color.trim() || null,
        cert_requirements: [],
      };
      if (editing) {
        await apiFetch<ShiftDefinition>(`/api/v1/pulse/schedule/shift-definitions/${draft.id}`, {
          method: "PATCH",
          json: payload,
        });
      } else {
        await apiFetch<ShiftDefinition>("/api/v1/pulse/schedule/shift-definitions", {
          method: "POST",
          json: payload,
        });
      }
      setDraft({ id: "", code: "", name: "", start: "08:00", end: "16:00", shift_type: "day", color: "" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save shift definition.");
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    if (!window.confirm("Delete this shift definition? Existing shifts will keep their stored shift_code.")) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch<void>(`/api/v1/pulse/schedule/shift-definitions/${id}`, { method: "DELETE" });
      if (draft.id === id) {
        setDraft({ id: "", code: "", name: "", start: "08:00", end: "16:00", shift_type: "day", color: "" });
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete shift definition.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-pulse-muted">Loading…</div>;
  }

  return (
    <div className="w-full pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ds-foreground">Shift definitions</h1>
          <p className="mt-1 text-sm text-ds-muted">
            Minimal builder for schedule phase 1. Codes show on the grid (e.g. D1, PM2).
          </p>
        </div>
        <a href="/schedule" className="text-sm font-semibold text-ds-accent underline">
          Back to Schedule
        </a>
      </div>

      {err ? (
        <div className="mt-4 rounded-md border border-ds-danger/40 bg-ds-danger/10 px-3 py-2 text-sm text-ds-foreground">
          {err}
        </div>
      ) : null}

      <div className="mt-6 rounded-md border border-pulseShell-border bg-pulseShell-surface p-4">
        <h2 className="text-sm font-semibold text-ds-foreground">{editing ? "Edit definition" : "New definition"}</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-ds-muted">Code</label>
            <input
              className={FIELD}
              value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
              placeholder="D1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ds-muted">Name (optional)</label>
            <input
              className={FIELD}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Day shift"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ds-muted">Start</label>
            <input className={FIELD} type="time" value={draft.start} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ds-muted">End</label>
            <input className={FIELD} type="time" value={draft.end} onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ds-muted">Shift type</label>
            <input className={FIELD} value={draft.shift_type} onChange={(e) => setDraft((d) => ({ ...d, shift_type: e.target.value }))} placeholder="day" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ds-muted">Color (optional)</label>
            <input className={FIELD} value={draft.color} onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))} placeholder="#3b82f6" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-pulseShell-border bg-ds-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={save}
            disabled={busy || !draft.code.trim()}
          >
            {busy ? "Saving…" : editing ? "Save" : "Create"}
          </button>
          {editing ? (
            <button
              type="button"
              className="rounded-md border border-pulseShell-border bg-pulseShell-elevated px-3 py-2 text-sm font-semibold text-ds-foreground"
              onClick={() => setDraft({ id: "", code: "", name: "", start: "08:00", end: "16:00", shift_type: "day", color: "" })}
              disabled={busy}
            >
              Cancel
            </button>
          ) : null}
          <div className="text-xs text-ds-muted">
            Stored as minutes: {hhmmFromMin(minFromHhmm(draft.start))}–{hhmmFromMin(minFromHhmm(draft.end))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-pulseShell-border bg-pulseShell-surface">
        <div className="border-b border-pulseShell-border px-4 py-3 text-sm font-semibold text-ds-foreground">
          Existing definitions ({rows.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-ds-muted">
              <tr className="border-b border-pulseShell-border">
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Window</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-pulseShell-border last:border-b-0">
                  <td className="px-4 py-2 font-mono font-bold">{r.code}</td>
                  <td className="px-4 py-2">{r.name || "—"}</td>
                  <td className="px-4 py-2">
                    {hhmmFromMin(r.start_min)}–{hhmmFromMin(r.end_min)}
                  </td>
                  <td className="px-4 py-2">{r.shift_type}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-pulseShell-border bg-pulseShell-elevated px-2.5 py-1 text-xs font-semibold text-ds-foreground"
                        onClick={() =>
                          setDraft({
                            id: r.id,
                            code: r.code,
                            name: r.name ?? "",
                            start: hhmmFromMin(r.start_min),
                            end: hhmmFromMin(r.end_min),
                            shift_type: r.shift_type,
                            color: r.color ?? "",
                          })
                        }
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-ds-danger/40 bg-ds-danger/10 px-2.5 py-1 text-xs font-semibold text-ds-foreground"
                        onClick={() => del(r.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-ds-muted" colSpan={5}>
                    No shift definitions yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

