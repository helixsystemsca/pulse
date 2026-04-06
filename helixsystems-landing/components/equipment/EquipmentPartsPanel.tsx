"use client";

import { AlertTriangle, Camera, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/pulse/Card";
import {
  addDaysToDateString,
  comparePartsByPriorityThenName,
  localDateString,
  normalizePartStatus,
  partPriorityFromStatus,
  priorityLabel,
  statusSeverity,
} from "@/lib/equipmentPartUi";
import {
  createEquipmentPart,
  deleteEquipmentPart,
  fetchEquipmentParts,
  patchEquipmentPart,
  resolveEquipmentAssetUrl,
  uploadEquipmentPartImage,
  type EquipmentPartRow,
} from "@/lib/equipmentService";

const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";
const SECONDARY_BTN =
  "rounded-[10px] border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-pulse-navy shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 disabled:opacity-60";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusUi(status: string): { label: string; className: string } {
  if (status === "overdue") return { label: "Overdue", className: "bg-red-50 text-red-900 ring-1 ring-red-200/80" };
  if (status === "due_soon") return { label: "Due soon", className: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80" };
  return { label: "OK", className: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80" };
}

function priorityUi(priority: ReturnType<typeof partPriorityFromStatus>): { label: string; className: string } {
  if (priority === "high") return { label: "High", className: "bg-rose-50 text-rose-900 ring-1 ring-rose-200/75" };
  if (priority === "medium") return { label: "Medium", className: "bg-sky-50 text-[#1e4a8a] ring-1 ring-sky-200/70" };
  return { label: "Low", className: "bg-slate-50 text-slate-600 ring-1 ring-slate-200/80" };
}

type Props = {
  equipmentId: string;
  equipmentName: string;
  canMutate: boolean;
  onPartsChanged?: () => void;
};

export function EquipmentPartsPanel({ equipmentId, equipmentName, canMutate, onPartsChanged }: Props) {
  const router = useRouter();
  const [parts, setParts] = useState<EquipmentPartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const prevStatusByPartId = useRef<Map<string, string>>(new Map());
  const didInitStatusRef = useRef(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newInterval, setNewInterval] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editInterval, setEditInterval] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editNext, setEditNext] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchEquipmentParts(equipmentId);
      setParts(rows);
    } catch {
      setError("Could not load parts.");
      setParts([]);
    } finally {
      setLoading(false);
    }
  }, [equipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    didInitStatusRef.current = false;
    prevStatusByPartId.current = new Map();
  }, [equipmentId]);

  const sortedParts = useMemo(() => [...parts].sort(comparePartsByPriorityThenName), [parts]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  /** After load: detect status worsening (ok → due_soon/overdue, due_soon → overdue) and notify. */
  useEffect(() => {
    if (loading) return;
    const map = new Map(parts.map((p) => [p.id, p.maintenance_status]));
    if (!didInitStatusRef.current) {
      prevStatusByPartId.current = map;
      didInitStatusRef.current = true;
      return;
    }
    const messages: string[] = [];
    for (const p of parts) {
      const prevRaw = prevStatusByPartId.current.get(p.id);
      if (prevRaw === undefined) continue;
      const prev = normalizePartStatus(prevRaw);
      const next = normalizePartStatus(p.maintenance_status);
      if (statusSeverity(next) <= statusSeverity(prev)) continue;
      if (next === "overdue") {
        messages.push(`${p.name} is overdue for replacement`);
      } else if (next === "due_soon") {
        messages.push(`${p.name} is due for replacement`);
      }
    }
    prevStatusByPartId.current = map;
    if (messages.length > 0) {
      setToast(messages.slice(0, 3).join(" · ") + (messages.length > 3 ? " …" : ""));
    }
  }, [loading, parts]);

  const notify = () => {
    onPartsChanged?.();
  };

  const onAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !canMutate) return;
    setSaving(true);
    try {
      const intervalRaw = newInterval.trim();
      const intervalParsed = intervalRaw ? parseInt(intervalRaw, 10) : NaN;
      await createEquipmentPart(equipmentId, {
        name: newName.trim(),
        quantity: Math.max(0, parseInt(newQty, 10) || 1),
        replacement_interval_days:
          intervalRaw && !Number.isNaN(intervalParsed) && intervalParsed >= 1 ? intervalParsed : null,
        last_replaced_date: newLast || null,
        notes: newNotes.trim() || null,
      });
      setNewName("");
      setNewQty("1");
      setNewInterval("");
      setNewLast("");
      setNewNotes("");
      setShowAdd(false);
      await load();
      notify();
    } catch {
      setError("Could not add part.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p: EquipmentPartRow) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditQty(String(p.quantity));
    setEditInterval(p.replacement_interval_days != null ? String(p.replacement_interval_days) : "");
    setEditLast(p.last_replaced_date ? p.last_replaced_date.slice(0, 10) : "");
    setEditNext(p.next_replacement_date ? p.next_replacement_date.slice(0, 10) : "");
    setEditNotes(p.notes ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const onEditSave = async (partId: string) => {
    if (!canMutate) return;
    setSaving(true);
    try {
      const intervalRaw = editInterval.trim();
      const intervalParsed = intervalRaw ? parseInt(intervalRaw, 10) : NaN;
      await patchEquipmentPart(partId, {
        name: editName.trim(),
        quantity: Math.max(0, parseInt(editQty, 10) || 0),
        replacement_interval_days:
          intervalRaw && !Number.isNaN(intervalParsed) && intervalParsed >= 1 ? intervalParsed : null,
        last_replaced_date: editLast || null,
        next_replacement_date: editNext || null,
        notes: editNotes.trim() || null,
      });
      setEditingId(null);
      await load();
      notify();
    } catch {
      setError("Could not update part.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (partId: string) => {
    if (!canMutate || !confirm("Delete this part?")) return;
    try {
      await deleteEquipmentPart(partId);
      await load();
      notify();
    } catch {
      setError("Could not delete part.");
    }
  };

  const onPartImage = async (partId: string, file: File | null) => {
    if (!file || !canMutate) return;
    setSaving(true);
    try {
      await uploadEquipmentPartImage(partId, file);
      await load();
      notify();
    } catch {
      setError("Image upload failed.");
    } finally {
      setSaving(false);
    }
  };

  const openWorkRequest = (p: EquipmentPartRow) => {
    const title = encodeURIComponent(`Replace / service: ${p.name} (${equipmentName})`);
    router.push(
      `/dashboard/maintenance/work-requests?create=1&equipment_id=${encodeURIComponent(equipmentId)}&part_id=${encodeURIComponent(p.id)}&wr_title=${title}`,
    );
  };

  const markAsReplaced = async (p: EquipmentPartRow) => {
    if (!canMutate) return;
    const interval = p.replacement_interval_days;
    if (interval == null || interval < 1) {
      setToast("Set a replacement interval (days) before using Mark as replaced.");
      return;
    }
    setSaving(true);
    try {
      const today = localDateString();
      const next = addDaysToDateString(today, interval);
      await patchEquipmentPart(p.id, {
        last_replaced_date: today,
        next_replacement_date: next,
      });
      setToast("Part marked as replaced");
      await load();
      notify();
    } catch {
      setError("Could not update replacement date.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${LABEL}`}>Parts &amp; components</h2>
        {canMutate ? (
          <button type="button" className={SECONDARY_BTN} onClick={() => setShowAdd((v) => !v)}>
            <Plus className="mr-1 inline h-4 w-4" aria-hidden />
            Add part
          </button>
        ) : null}
      </div>

      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[60] max-w-lg -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-pulse-navy shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {showAdd && canMutate ? (
        <Card padding="md">
          <form onSubmit={(e) => void onAddSubmit(e)} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={LABEL} htmlFor="new-part-name">
                Name *
              </label>
              <input
                id="new-part-name"
                className={FIELD}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="new-part-qty">
                Quantity
              </label>
              <input
                id="new-part-qty"
                type="number"
                min={0}
                className={FIELD}
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="new-part-int">
                Replacement interval (days)
              </label>
              <input
                id="new-part-int"
                type="number"
                min={1}
                className={FIELD}
                placeholder="e.g. 180"
                value={newInterval}
                onChange={(e) => setNewInterval(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="new-part-last">
                Last replaced
              </label>
              <input
                id="new-part-last"
                type="date"
                className={FIELD}
                value={newLast}
                onChange={(e) => setNewLast(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className={LABEL} htmlFor="new-part-notes">
                Notes
              </label>
              <textarea id="new-part-notes" className={`${FIELD} min-h-[72px]`} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button type="submit" className={PRIMARY_BTN} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save part"}
              </button>
              <button type="button" className={SECONDARY_BTN} onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card padding="md" className="!p-0 overflow-x-auto">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-pulse-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading parts…
          </div>
        ) : parts.length === 0 ? (
          <p className="p-6 text-sm text-pulse-muted">No parts recorded. Add components to track replacement cycles.</p>
        ) : (
          <table className="min-w-[840px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-4 py-3 font-semibold text-pulse-navy">Part</th>
                <th className="px-4 py-3 font-semibold text-pulse-navy">Qty</th>
                <th className="px-4 py-3 font-semibold text-pulse-navy">Last replaced</th>
                <th className="px-4 py-3 font-semibold text-pulse-navy">Next</th>
                <th className="px-4 py-3 font-semibold text-pulse-navy">Status</th>
                <th className="px-4 py-3 font-semibold text-pulse-navy">Priority</th>
                <th className="px-4 py-3 font-semibold text-pulse-navy">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedParts.map((p) => {
                const su = statusUi(p.maintenance_status);
                const pr = partPriorityFromStatus(normalizePartStatus(p.maintenance_status));
                const pu = priorityUi(pr);
                const needsAttention = p.maintenance_status === "overdue" || p.maintenance_status === "due_soon";
                const imgSrc = resolveEquipmentAssetUrl(p.image_url);
                const canMarkReplaced =
                  canMutate && p.replacement_interval_days != null && p.replacement_interval_days >= 1 && editingId !== p.id;
                return (
                  <tr key={p.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      {editingId === p.id ? (
                        <input className={FIELD} value={editName} onChange={(e) => setEditName(e.target.value)} />
                      ) : (
                        <div className="flex items-start gap-2">
                          {imgSrc ? (
                            <img src={imgSrc} alt="" className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200" />
                          ) : null}
                          <div>
                            <p className="font-medium text-pulse-navy">{p.name}</p>
                            {needsAttention ? (
                              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-800">
                                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                                Needs maintenance
                              </p>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-pulse-muted tabular-nums">
                      {editingId === p.id ? (
                        <input className={FIELD} type="number" min={0} value={editQty} onChange={(e) => setEditQty(e.target.value)} />
                      ) : (
                        p.quantity
                      )}
                    </td>
                    <td className="px-4 py-3 text-pulse-muted tabular-nums">
                      {editingId === p.id ? (
                        <input className={FIELD} type="date" value={editLast} onChange={(e) => setEditLast(e.target.value)} />
                      ) : (
                        formatDate(p.last_replaced_date)
                      )}
                    </td>
                    <td className="px-4 py-3 text-pulse-muted tabular-nums">
                      {editingId === p.id ? (
                        <input className={FIELD} type="date" value={editNext} onChange={(e) => setEditNext(e.target.value)} />
                      ) : (
                        formatDate(p.next_replacement_date)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${su.className}`}>{su.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pu.className}`}
                        title={`Severity: ${priorityLabel(pr)}`}
                      >
                        {pu.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === p.id ? (
                        <div className="flex flex-col gap-2">
                          <div>
                            <label className={LABEL}>Interval (days)</label>
                            <input className={FIELD} type="number" min={1} value={editInterval} onChange={(e) => setEditInterval(e.target.value)} />
                          </div>
                          <div>
                            <label className={LABEL}>Notes</label>
                            <textarea className={`${FIELD} min-h-[60px]`} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <button type="button" className={PRIMARY_BTN} disabled={saving} onClick={() => void onEditSave(p.id)}>
                              Save
                            </button>
                            <button type="button" className={SECONDARY_BTN} onClick={cancelEdit}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {canMarkReplaced ? (
                            <button
                              type="button"
                              className="rounded-[10px] bg-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
                              disabled={saving}
                              title="Sets last replaced to today and next date from interval"
                              onClick={() => void markAsReplaced(p)}
                            >
                              Mark as replaced
                            </button>
                          ) : null}
                          {needsAttention ? (
                            <button type="button" className={PRIMARY_BTN} onClick={() => openWorkRequest(p)}>
                              Create work request
                            </button>
                          ) : null}
                          {canMutate ? (
                            <div className="flex flex-wrap gap-1">
                              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-pulse-navy hover:bg-slate-50">
                                <Camera className="h-3.5 w-3.5" aria-hidden />
                                Photo
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/*"
                                  capture="environment"
                                  className="sr-only"
                                  onChange={(e) => void onPartImage(p.id, e.target.files?.[0] ?? null)}
                                />
                              </label>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-pulse-navy hover:bg-slate-50"
                                onClick={() => startEdit(p)}
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                                onClick={() => void onDelete(p.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}
