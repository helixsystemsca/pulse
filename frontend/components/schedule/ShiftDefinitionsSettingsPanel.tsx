"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { apiFetch, isApiMode } from "@/lib/api";
import {
  hhmmFromMinutes,
  minutesFromHhmm,
  type ScheduleShiftDefinitionRow,
} from "@/lib/schedule/palette-config";

const FIELD =
  "w-full rounded-md border border-pulseShell-border bg-pulseShell-surface px-2.5 py-1.5 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ds-primary/40";

type Props = {
  shiftDefinitions: ScheduleShiftDefinitionRow[];
  onShiftDefinitionsChange: (rows: ScheduleShiftDefinitionRow[]) => void;
};

export function ShiftDefinitionsSettingsPanel({ shiftDefinitions, onShiftDefinitionsChange }: Props) {
  const api = isApiMode();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shiftDraft, setShiftDraft] = useState({
    id: "" as string | "",
    code: "",
    name: "",
    start: "08:00",
    end: "16:00",
    shift_type: "day",
    color: "",
  });

  const editing = Boolean(shiftDraft.id);

  async function saveShift() {
    if (!api) return;
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        code: shiftDraft.code.trim(),
        name: shiftDraft.name.trim() || null,
        start_min: minutesFromHhmm(shiftDraft.start),
        end_min: minutesFromHhmm(shiftDraft.end),
        shift_type: shiftDraft.shift_type.trim() || "day",
        color: shiftDraft.color.trim() || null,
        cert_requirements: [],
      };
      if (shiftDraft.id) {
        await apiFetch<ScheduleShiftDefinitionRow>(`/api/v1/pulse/schedule/shift-definitions/${shiftDraft.id}`, {
          method: "PATCH",
          json: payload,
        });
      } else {
        await apiFetch<ScheduleShiftDefinitionRow>("/api/v1/pulse/schedule/shift-definitions", {
          method: "POST",
          json: payload,
        });
      }
      const rows = await apiFetch<ScheduleShiftDefinitionRow[]>("/api/v1/pulse/schedule/shift-definitions");
      onShiftDefinitionsChange(rows);
      setShiftDraft({ id: "", code: "", name: "", start: "08:00", end: "16:00", shift_type: "day", color: "" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save shift definition.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteShift(id: string) {
    if (!api) return;
    if (!window.confirm("Delete this shift definition? Existing shifts keep their stored shift_code.")) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch<void>(`/api/v1/pulse/schedule/shift-definitions/${id}`, { method: "DELETE" });
      const rows = await apiFetch<ScheduleShiftDefinitionRow[]>("/api/v1/pulse/schedule/shift-definitions");
      onShiftDefinitionsChange(rows);
      if (shiftDraft.id === id) {
        setShiftDraft({ id: "", code: "", name: "", start: "08:00", end: "16:00", shift_type: "day", color: "" });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete shift definition.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Shift codes appear on the calendar and assignment palette (e.g. D1, PM2). Configure standard start/end windows
        and bands here.
      </p>

      {err ? (
        <p className="rounded-md border border-rose-500/40 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
          {err}
        </p>
      ) : null}

      {!api ? (
        <p className="text-sm text-ds-muted">
          Connect the app to your tenant API to create and edit shift definitions. Demo mode uses the built-in catalog on
          the palette.
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-pulseShell-border/80 bg-ds-secondary/20 p-3">
            <h3 className="text-sm font-semibold text-ds-foreground">{editing ? "Edit shift" : "New shift"}</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div>
                <label className={LABEL}>Code</label>
                <input
                  className={FIELD}
                  value={shiftDraft.code}
                  onChange={(e) => setShiftDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                  placeholder="D1"
                />
              </div>
              <div className="col-span-2">
                <label className={LABEL}>Name</label>
                <input
                  className={FIELD}
                  value={shiftDraft.name}
                  onChange={(e) => setShiftDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Day shift"
                />
              </div>
              <div>
                <label className={LABEL}>Start</label>
                <input
                  className={FIELD}
                  type="time"
                  value={shiftDraft.start}
                  onChange={(e) => setShiftDraft((d) => ({ ...d, start: e.target.value }))}
                />
              </div>
              <div>
                <label className={LABEL}>End</label>
                <input
                  className={FIELD}
                  type="time"
                  value={shiftDraft.end}
                  onChange={(e) => setShiftDraft((d) => ({ ...d, end: e.target.value }))}
                />
              </div>
              <div>
                <label className={LABEL}>Band</label>
                <select
                  className={FIELD}
                  value={shiftDraft.shift_type}
                  onChange={(e) => setShiftDraft((d) => ({ ...d, shift_type: e.target.value }))}
                >
                  <option value="day">day</option>
                  <option value="afternoon">afternoon</option>
                  <option value="night">night</option>
                </select>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <label className={LABEL}>Color (optional)</label>
                <input
                  className={FIELD}
                  value={shiftDraft.color}
                  onChange={(e) => setShiftDraft((d) => ({ ...d, color: e.target.value }))}
                  placeholder="#3b82f6"
                />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-pulseShell-border bg-ds-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                disabled={busy || !shiftDraft.code.trim()}
                onClick={() => void saveShift()}
              >
                {busy ? "Saving…" : editing ? "Save" : "Create"}
              </button>
              {editing ? (
                <button
                  type="button"
                  className="rounded-md border border-pulseShell-border px-3 py-1.5 text-sm font-semibold"
                  onClick={() =>
                    setShiftDraft({ id: "", code: "", name: "", start: "08:00", end: "16:00", shift_type: "day", color: "" })
                  }
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>

          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-pulseShell-border/80">
            {shiftDefinitions.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-pulseShell-border/60 px-3 py-2 last:border-0"
              >
                <div>
                  <span className="font-mono font-bold">{r.code}</span>
                  {r.name ? <span className="ml-2 text-sm text-ds-foreground">{r.name}</span> : null}
                  <span className="ml-2 text-xs text-ds-muted">
                    {hhmmFromMinutes(r.start_min)}–{hhmmFromMinutes(r.end_min)} · {r.shift_type}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded border border-pulseShell-border p-1"
                    aria-label={`Edit ${r.code}`}
                    onClick={() =>
                      setShiftDraft({
                        id: r.id,
                        code: r.code,
                        name: r.name ?? "",
                        start: hhmmFromMinutes(r.start_min),
                        end: hhmmFromMinutes(r.end_min),
                        shift_type: r.shift_type,
                        color: r.color ?? "",
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded border border-rose-500/40 p-1 text-rose-700"
                    disabled={busy}
                    aria-label={`Delete ${r.code}`}
                    onClick={() => void deleteShift(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
            {shiftDefinitions.length === 0 ? (
              <li className="px-3 py-4 text-sm text-ds-muted">No shift definitions yet — defaults show in the palette.</li>
            ) : null}
          </ul>
        </>
      )}
    </div>
  );
}

const LABEL = "text-[10px] font-semibold uppercase text-ds-muted";
