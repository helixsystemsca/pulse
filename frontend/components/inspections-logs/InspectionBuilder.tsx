"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { newId } from "@/lib/inspectionsLogsStorage";
import type {
  InspectionChecklistItem,
  InspectionItemResponseType,
  InspectionTemplate,
} from "@/lib/inspectionsLogsTypes";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const FIELD =
  "app-field mt-1.5 w-full rounded-md border-ds-border bg-ds-primary text-ds-foreground placeholder:text-ds-muted focus:border-ds-success/40 focus:ring-2 focus:ring-[var(--ds-focus-ring)]";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const BTN_SECONDARY = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-xs font-semibold");
const BTN_PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2 text-sm font-semibold disabled:opacity-45");

function sortItems(items: InspectionChecklistItem[]): InspectionChecklistItem[] {
  return [...items].sort((a, b) => a.order - b.order);
}

const RESPONSE_TYPES: { value: InspectionItemResponseType; label: string }[] = [
  { value: "checkbox", label: "Checkbox" },
  { value: "text", label: "Short text" },
  { value: "number", label: "Number" },
  { value: "notes", label: "Long text" },
  { value: "yes_no", label: "Yes / No" },
];

export function InspectionBuilder({
  initial,
  onSave,
  onCancel,
}: {
  initial: InspectionTemplate | null;
  onSave: (t: InspectionTemplate) => void;
  onCancel: () => void;
}) {
  const now = useMemo(() => new Date().toISOString(), []);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [items, setItems] = useState<InspectionChecklistItem[]>(() =>
    sortItems(initial?.checklist_items?.length ? initial.checklist_items : []),
  );
  const [linkedEquipmentId, setLinkedEquipmentId] = useState(initial?.linked_equipment_id ?? "");
  const [linkedZoneId, setLinkedZoneId] = useState(initial?.linked_zone_id ?? "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "");

  const addItem = useCallback((response_type: InspectionItemResponseType = "checkbox") => {
    setItems((prev) => {
      const nextOrder = prev.length === 0 ? 0 : Math.max(...prev.map((p) => p.order)) + 1;
      return [...prev, { id: newId(), label: "", order: nextOrder, response_type }];
    });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<InspectionChecklistItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const move = useCallback((id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const sorted = sortItems(prev);
      const idx = sorted.findIndex((i) => i.id === id);
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
    const checklist_items = sortItems(items)
      .filter((i) => i.label.trim())
      .map((i, idx) => ({
        ...i,
        label: i.label.trim(),
        order: idx,
        response_type: i.response_type ?? "checkbox",
      }));
    const base = initial;
    const t: InspectionTemplate = {
      id: base?.id ?? newId(),
      type: "inspection",
      name: trimmed,
      description: description.trim() || undefined,
      checklist_items,
      linked_equipment_id: linkedEquipmentId.trim() || null,
      linked_zone_id: linkedZoneId.trim() || null,
      frequency: frequency.trim() || null,
      created_at: base?.created_at ?? now,
      updated_at: now,
    };
    onSave(t);
  };

  return (
    <div className="rounded-md border border-ds-border bg-ds-primary p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-ds-foreground">
        {initial ? "Edit inspection template" : "New inspection template"}
      </h2>
      <p className="mt-1 text-sm text-ds-muted">
        Add any mix of checkboxes, short or long text, numbers, and yes/no lines. Each line is one question or check.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL}>Name</label>
          <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="Daily pool check" />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>Description (optional)</label>
          <textarea
            className={`${FIELD} min-h-[72px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Context for your team"
          />
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={LABEL}>Checklist items</span>
          <div className="flex flex-wrap gap-2">
            {RESPONSE_TYPES.map((rt) => (
              <button key={rt.value} type="button" className={BTN_SECONDARY} onClick={() => addItem(rt.value)}>
                <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                {rt.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-3 space-y-2">
          {sortItems(items).map((item, idx) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-ds-border bg-ds-secondary px-3 py-2 sm:flex-nowrap"
            >
              <select
                className="rounded-lg border border-ds-border bg-ds-primary px-2 py-1.5 text-xs font-medium text-ds-foreground"
                value={item.response_type ?? "checkbox"}
                onChange={(e) =>
                  updateItem(item.id, { response_type: e.target.value as InspectionItemResponseType })
                }
              >
                {RESPONSE_TYPES.map((rt) => (
                  <option key={rt.value} value={rt.value}>
                    {rt.label}
                  </option>
                ))}
              </select>
              <input
                className="min-w-0 flex-1 rounded-lg border border-ds-border bg-ds-primary px-2 py-1.5 text-sm text-ds-foreground placeholder:text-ds-muted focus:outline-none focus:ring-2 focus:ring-[var(--ds-focus-ring)]"
                value={item.label}
                onChange={(e) => updateItem(item.id, { label: e.target.value })}
                placeholder={`Item ${idx + 1}`}
              />
              <div className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
                  aria-label="Move up"
                  onClick={() => move(item.id, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
                  aria-label="Move down"
                  onClick={() => move(item.id, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-red-600 hover:bg-red-100/80 dark:text-red-400 dark:hover:bg-red-500/15"
                  aria-label="Remove"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {items.length === 0 ? <p className="mt-2 text-sm text-ds-muted">Add at least one checklist item.</p> : null}
      </div>

      <div className="mt-8 border-t border-ds-border pt-6">
        <p className={LABEL}>Future automation (optional)</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs text-ds-muted">Linked equipment ID</label>
            <input
              className={FIELD}
              value={linkedEquipmentId}
              onChange={(e) => setLinkedEquipmentId(e.target.value)}
              placeholder="—"
            />
          </div>
          <div>
            <label className="text-xs text-ds-muted">Linked zone ID</label>
            <input
              className={FIELD}
              value={linkedZoneId}
              onChange={(e) => setLinkedZoneId(e.target.value)}
              placeholder="—"
            />
          </div>
          <div>
            <label className="text-xs text-ds-muted">Frequency</label>
            <input
              className={FIELD}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="e.g. daily"
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
