"use client";

import { Plus, Trash2 } from "lucide-react";
import type { InventoryCategoryConfig } from "@/lib/inventory/register-form-config";
import { newCategoryDraft } from "@/lib/inventory/register-form-config";
import { cn } from "@/lib/cn";

const FIELD =
  "mt-1 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";
const BTN =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-pulse-navy hover:bg-ds-interactive-hover";

type Props = {
  categories: InventoryCategoryConfig[];
  onChange: (next: InventoryCategoryConfig[]) => void;
  compact?: boolean;
};

export function InventoryCategoryEditor({ categories, onChange, compact }: Props) {
  function updateCategory(id: string, patch: Partial<InventoryCategoryConfig>) {
    onChange(categories.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeCategory(id: string) {
    onChange(categories.filter((c) => c.id !== id));
  }

  function addCategory() {
    onChange([...categories, newCategoryDraft("")]);
  }

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      <p className="text-sm text-pulse-muted">
        Define category groups for the register form. Add dropdown options under each category when you need a second
        level (for example Electrical → Wire, Breakers).
      </p>
      {categories.map((cat, idx) => (
        <div key={cat.id} className="rounded-xl border border-slate-200/90 bg-white/80 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <label className={LABEL} htmlFor={`inv-cat-name-${cat.id}`}>
                  Category {idx + 1}
                </label>
                <input
                  id={`inv-cat-name-${cat.id}`}
                  className={FIELD}
                  value={cat.name}
                  placeholder="e.g. Electrical"
                  onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor={`inv-cat-opts-${cat.id}`}>
                  Dropdown options (one per line)
                </label>
                <textarea
                  id={`inv-cat-opts-${cat.id}`}
                  className={cn(FIELD, "min-h-[88px] font-mono text-xs")}
                  value={cat.options.join("\n")}
                  placeholder={"Wire\nBreakers\nLighting"}
                  onChange={(e) =>
                    updateCategory(cat.id, {
                      options: e.target.value.split("\n").map((l) => l.trim()),
                    })
                  }
                />
                <p className="mt-1 text-[11px] text-pulse-muted">
                  Leave empty to use the category name as the stored value.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg p-2 text-rose-600 hover:bg-rose-50"
              aria-label={`Remove ${cat.name || "category"}`}
              onClick={() => removeCategory(cat.id)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <button type="button" className={BTN} onClick={addCategory}>
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Add category
      </button>
    </div>
  );
}
