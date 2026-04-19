"use client";

import { CalendarClock, Loader2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/pulse/Card";
import {
  dsCheckboxClass,
  dsInputClass,
  dsInputStackedClass,
  dsLabelClass,
  dsSelectClass,
} from "@/components/ui/ds-form-classes";
import {
  createPmTask,
  deletePmTask,
  fetchEquipmentParts,
  fetchPmTasks,
  type EquipmentPartRow,
  type PmTaskCreatePayload,
  type PmTaskRow,
} from "@/lib/equipmentService";

const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatFrequency(t: PmTaskRow): string {
  const u = t.frequency_type === "days" ? "day" : t.frequency_type === "weeks" ? "week" : "month";
  const pl = t.frequency_value === 1 ? "" : "s";
  return `Every ${t.frequency_value} ${u}${pl}`;
}

type ChecklistDraft = { id: string; label: string };

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type Props = {
  equipmentId: string;
  canMutate: boolean;
  onTasksChanged?: () => void;
};

export function EquipmentPmTasksSection({ equipmentId, canMutate, onTasksChanged }: Props) {
  const [tasks, setTasks] = useState<PmTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parts, setParts] = useState<EquipmentPartRow[]>([]);
  const [name, setName] = useState("");
  const [freqValue, setFreqValue] = useState(30);
  const [freqType, setFreqType] = useState<"days" | "weeks" | "months">("days");
  const [duration, setDuration] = useState<string>("");
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(() => new Set());
  const [checklist, setChecklist] = useState<ChecklistDraft[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPmTasks(equipmentId);
      setTasks(rows);
    } catch {
      setError("Could not load preventive maintenance tasks.");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [equipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openModal = () => {
    setError(null);
    setName("");
    setFreqValue(30);
    setFreqType("days");
    setDuration("");
    setSelectedPartIds(new Set());
    setChecklist([]);
    setModalOpen(true);
    void (async () => {
      try {
        const p = await fetchEquipmentParts(equipmentId);
        setParts(p);
      } catch {
        setParts([]);
      }
    })();
  };

  const togglePart = (id: string) => {
    setSelectedPartIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitModal = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const dur = duration.trim() ? Number.parseInt(duration, 10) : undefined;
    if (duration.trim() && (Number.isNaN(dur!) || dur! < 1)) {
      setError("Estimated duration must be a positive number of minutes.");
      return;
    }
    const payload: PmTaskCreatePayload = {
      name: trimmed,
      frequency_type: freqType,
      frequency_value: Math.max(1, Math.min(3650, freqValue)),
      estimated_duration_minutes: dur,
      parts: [...selectedPartIds].map((part_id) => ({ part_id, quantity: 1 })),
      checklist: checklist.filter((c) => c.label.trim()).map((c, i) => ({ label: c.label.trim(), sort_order: i })),
    };
    setSaving(true);
    setError(null);
    try {
      await createPmTask(equipmentId, payload);
      setModalOpen(false);
      await load();
      onTasksChanged?.();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "body" in e && (e as { body?: { detail?: string } }).body?.detail;
      setError(typeof msg === "string" ? msg : "Could not save PM task.");
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async (taskId: string) => {
    if (!globalThis.confirm("Delete this preventive maintenance task?")) return;
    try {
      await deletePmTask(equipmentId, taskId);
      await load();
      onTasksChanged?.();
    } catch {
      setError("Could not delete PM task.");
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${SECTION_LABEL} inline-flex items-center gap-2`}>
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          Preventive maintenance
        </h2>
        {canMutate ? (
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-pulse-navy shadow-sm hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add PM task
          </button>
        ) : null}
      </div>
      {error && !modalOpen ? <p className="text-sm text-red-700">{error}</p> : null}
      <Card padding="md" className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-pulse-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : tasks.length === 0 ? (
          <p className="p-4 text-sm text-pulse-muted">
            No PM tasks yet. Add one to automatically schedule preventative work orders before each due date.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-pulse-navy">{t.name}</p>
                  <p className="mt-0.5 text-xs text-pulse-muted">
                    {formatFrequency(t)} · Next due {formatDate(t.next_due_at)}
                    {t.parts_count > 0 ? ` · ${t.parts_count} part${t.parts_count === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                {canMutate ? (
                  <button
                    type="button"
                    onClick={() => void removeTask(t.id)}
                    className="shrink-0 rounded-lg p-2 text-pulse-muted hover:bg-red-50 hover:text-red-800"
                    aria-label={`Delete ${t.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {modalOpen ? (
        <div
          className="ds-modal-backdrop fixed inset-0 z-[140] flex items-end justify-center p-4 backdrop-blur-[2px] sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pm-task-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h3 id="pm-task-modal-title" className="text-lg font-semibold text-pulse-navy">
                Add PM task
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-pulse-muted hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
            <div className="mt-4 space-y-4">
              <div>
                <label className={dsLabelClass} htmlFor="pm-name">
                  Task name
                </label>
                <input
                  id="pm-name"
                  className={dsInputStackedClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Grease bearings"
                  autoFocus
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label className={dsLabelClass} htmlFor="pm-freq-value">
                    Frequency
                  </label>
                  <input
                    id="pm-freq-value"
                    type="number"
                    min={1}
                    max={3650}
                    className={dsInputStackedClass}
                    value={freqValue}
                    onChange={(e) => setFreqValue(Number.parseInt(e.target.value, 10) || 1)}
                  />
                </div>
                <div>
                  <label className={`${dsLabelClass} sr-only`} htmlFor="pm-freq-type">
                    Unit
                  </label>
                  <select
                    id="pm-freq-type"
                    className={`mt-1.5 sm:mt-0 ${dsSelectClass}`}
                    value={freqType}
                    onChange={(e) => setFreqType(e.target.value as "days" | "weeks" | "months")}
                  >
                    <option value="days">days</option>
                    <option value="weeks">weeks</option>
                    <option value="months">months</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={dsLabelClass} htmlFor="pm-duration">
                  Estimated duration (minutes, optional)
                </label>
                <input
                  id="pm-duration"
                  type="number"
                  min={1}
                  className={dsInputStackedClass}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 45"
                />
              </div>
              <div>
                <p className={dsLabelClass}>Parts (optional)</p>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {parts.length === 0 ? (
                    <p className="text-xs text-pulse-muted">No parts on this equipment yet.</p>
                  ) : (
                    parts.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm text-pulse-navy">
                        <input
                          type="checkbox"
                          className={dsCheckboxClass}
                          checked={selectedPartIds.has(p.id)}
                          onChange={() => togglePart(p.id)}
                        />
                        <span className="truncate">{p.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className={dsLabelClass}>Checklist (optional)</p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#2B4C7E] hover:underline"
                    onClick={() => setChecklist((c) => [...c, { id: randomId(), label: "" }])}
                  >
                    + Add row
                  </button>
                </div>
                <ul className="mt-2 space-y-2">
                  {checklist.map((row) => (
                    <li key={row.id} className="flex gap-2">
                      <input
                        className={dsInputClass}
                        value={row.label}
                        onChange={(e) =>
                          setChecklist((rows) =>
                            rows.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r)),
                          )
                        }
                        placeholder="Checklist step"
                      />
                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-slate-200 px-2 text-pulse-muted hover:bg-slate-50"
                        onClick={() => setChecklist((rows) => rows.filter((r) => r.id !== row.id))}
                        aria-label="Remove row"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-[10px] border border-slate-200 px-4 py-2 text-sm font-semibold text-pulse-navy hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !name.trim()}
                onClick={() => void submitModal()}
                className="rounded-[10px] bg-[#2B4C7E] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
