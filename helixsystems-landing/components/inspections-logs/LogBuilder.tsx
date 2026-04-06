"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { newId } from "@/lib/inspectionsLogsStorage";
import type { LogFieldDef, LogFieldType, LogTemplate } from "@/lib/inspectionsLogsTypes";

const FIELD =
  "mt-1.5 w-full rounded-xl border border-stealth-border bg-stealth-main/40 px-3 py-2 text-sm text-stealth-primary placeholder:text-stealth-muted focus:border-stealth-accent/40 focus:outline-none focus:ring-1 focus:ring-stealth-accent/25";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-stealth-muted";
const BTN_SECONDARY =
  "rounded-xl border border-stealth-border bg-stealth-main/50 px-3 py-2 text-xs font-semibold text-stealth-primary transition-colors hover:bg-stealth-border/25";
const BTN_PRIMARY =
  "rounded-xl bg-stealth-accent px-4 py-2 text-sm font-semibold text-stealth-primary transition-[filter] hover:brightness-110 disabled:opacity-45";

function sortFields(fields: LogFieldDef[]): LogFieldDef[] {
  return [...fields].sort((a, b) => a.order - b.order);
}

const FIELD_TYPES: { value: LogFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "notes", label: "Notes" },
];

export function LogBuilder({
  initial,
  onSave,
  onCancel,
}: {
  initial: LogTemplate | null;
  onSave: (t: LogTemplate) => void;
  onCancel: () => void;
}) {
  const now = useMemo(() => new Date().toISOString(), []);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [fields, setFields] = useState<LogFieldDef[]>(() =>
    sortFields(initial?.fields?.length ? initial.fields : []),
  );
  const [linkedEquipmentId, setLinkedEquipmentId] = useState(initial?.linked_equipment_id ?? "");
  const [linkedZoneId, setLinkedZoneId] = useState(initial?.linked_zone_id ?? "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "");

  const addField = useCallback((type: LogFieldType) => {
    setFields((prev) => {
      const nextOrder = prev.length === 0 ? 0 : Math.max(...prev.map((p) => p.order)) + 1;
      return [...prev, { id: newId(), label: "", type, order: nextOrder }];
    });
  }, []);

  const updateField = useCallback((id: string, patch: Partial<LogFieldDef>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const move = useCallback((id: string, dir: -1 | 1) => {
    setFields((prev) => {
      const sorted = sortFields(prev);
      const idx = sorted.findIndex((f) => f.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= sorted.length) return prev;
      const next = [...sorted];
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next.map((item, i) => ({ ...item, order: i }));
    });
  }, []);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const cleaned = sortFields(fields)
      .filter((f) => f.label.trim())
      .map((f, idx) => ({ ...f, label: f.label.trim(), order: idx }));
    const base = initial;
    const t: LogTemplate = {
      id: base?.id ?? newId(),
      type: "log",
      name: trimmed,
      description: description.trim() || undefined,
      fields: cleaned,
      linked_equipment_id: linkedEquipmentId.trim() || null,
      linked_zone_id: linkedZoneId.trim() || null,
      frequency: frequency.trim() || null,
      created_at: base?.created_at ?? now,
      updated_at: now,
    };
    onSave(t);
  };

  return (
    <div className="rounded-2xl border border-stealth-border bg-stealth-card p-6 shadow-stealth-card">
      <h2 className="text-lg font-semibold text-stealth-primary">
        {initial ? "Edit log template" : "New log template"}
      </h2>
      <p className="mt-1 text-sm text-stealth-muted">
        Define fields for each submission. Timestamp is recorded automatically when an entry is saved.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL}>Name</label>
          <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="Zamboni log" />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>Description (optional)</label>
          <textarea
            className={`${FIELD} min-h-[72px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this log is for"
          />
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={LABEL}>Fields</span>
          <div className="flex flex-wrap gap-2">
            {FIELD_TYPES.map((ft) => (
              <button key={ft.value} type="button" className={BTN_SECONDARY} onClick={() => addField(ft.value)}>
                <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                {ft.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-3 space-y-2">
          {sortFields(fields).map((field, idx) => (
            <li
              key={field.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-stealth-border bg-stealth-main/35 px-3 py-2 sm:flex-nowrap"
            >
              <select
                className="rounded-lg border border-stealth-border bg-stealth-main/60 px-2 py-1.5 text-xs font-medium text-stealth-primary"
                value={field.type}
                onChange={(e) => updateField(field.id, { type: e.target.value as LogFieldType })}
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>
                    {ft.label}
                  </option>
                ))}
              </select>
              <input
                className="min-w-0 flex-1 rounded-lg border border-stealth-border bg-transparent px-2 py-1.5 text-sm text-stealth-primary placeholder:text-stealth-muted focus:outline-none focus:ring-1 focus:ring-stealth-accent/25"
                value={field.label}
                onChange={(e) => updateField(field.id, { label: e.target.value })}
                placeholder={`Field ${idx + 1} label`}
              />
              <div className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-stealth-muted hover:bg-stealth-border/30 hover:text-stealth-primary"
                  aria-label="Move up"
                  onClick={() => move(field.id, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-stealth-muted hover:bg-stealth-border/30 hover:text-stealth-primary"
                  aria-label="Move down"
                  onClick={() => move(field.id, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-stealth-danger/80 hover:bg-stealth-danger/10"
                  aria-label="Remove"
                  onClick={() => removeField(field.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {fields.length === 0 ? <p className="mt-2 text-sm text-stealth-muted">Add at least one field.</p> : null}
      </div>

      <div className="mt-8 border-t border-stealth-border pt-6">
        <p className={LABEL}>Future automation (optional)</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs text-stealth-secondary">Linked equipment ID</label>
            <input
              className={FIELD}
              value={linkedEquipmentId}
              onChange={(e) => setLinkedEquipmentId(e.target.value)}
              placeholder="—"
            />
          </div>
          <div>
            <label className="text-xs text-stealth-secondary">Linked zone ID</label>
            <input
              className={FIELD}
              value={linkedZoneId}
              onChange={(e) => setLinkedZoneId(e.target.value)}
              placeholder="—"
            />
          </div>
          <div>
            <label className="text-xs text-stealth-secondary">Frequency</label>
            <input
              className={FIELD}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="e.g. each shift"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className={BTN_PRIMARY} onClick={handleSave} disabled={!name.trim()}>
          Save template
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
