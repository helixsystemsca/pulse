"use client";

import Link from "next/link";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { ROADMAP_CATEGORIES } from "@/lib/roadmap/categories";
import { toIsoDate } from "@/lib/roadmap/timeline";
import { listCategories, type CategoryRow } from "@/lib/projectsService";
import { cn } from "@/lib/cn";

const fieldClass =
  "w-full rounded-lg border border-ds-border bg-ds-bg px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-ds-primary";

type Props = {
  year: number;
  canEdit: boolean;
  onAdded: () => void;
  onCreateStubs: (items: {
    name: string;
    start_date?: string;
    end_date?: string;
    category_id?: string;
  }[]) => Promise<void>;
};

export function RoadmapQuickAdd({ year, canEdit, onAdded, onCreateStubs }: Props) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  useEffect(() => {
    void listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!start) setStart(toIsoDate(new Date(year, 0, 1)));
    if (!end) setEnd(toIsoDate(new Date(year, 2, 28)));
  }, [year, start, end]);

  if (!canEdit) return null;

  async function addOne(e?: React.FormEvent) {
    e?.preventDefault();
    const name = title.trim();
    if (!name || !start || !end || saving) return;
    setSaving(true);
    try {
      await onCreateStubs([{ name, start_date: start, end_date: end, category_id: categoryId || undefined }]);
      setTitle("");
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  async function addBulk() {
    const names = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!names.length || saving) return;
    setSaving(true);
    try {
      await onCreateStubs(names.map((name) => ({ name })));
      setBulkText("");
      setBulkOpen(false);
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-ds-primary/40 bg-ds-primary/[0.04] p-3">
      <div>
        <p className="text-xs font-semibold text-ds-foreground">Quick add</p>
        <p className="text-[10px] leading-snug text-ds-muted">
          Placeholder initiatives — saved to Projects immediately. Or{" "}
          <Link href="/projects" className="font-medium text-ds-primary hover:underline">
            create a full project first
          </Link>
          .
        </p>
      </div>

      <form onSubmit={addOne} className="space-y-2">
        <input
          className={fieldClass}
          placeholder="Initiative name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
        />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className={fieldClass} value={start} onChange={(e) => setStart(e.target.value)} disabled={saving} />
          <input type="date" className={fieldClass} value={end} onChange={(e) => setEnd(e.target.value)} disabled={saving} />
        </div>
        {categories.length > 0 ? (
          <select className={fieldClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={saving}>
            <option value="">Category (optional)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <select className={fieldClass} value="" disabled>
            <option value="">No project categories yet</option>
          </select>
        )}
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-ds-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add placeholder
        </button>
      </form>

      <div>
        <button
          type="button"
          className="flex w-full items-center gap-1 text-xs font-medium text-ds-muted hover:text-ds-foreground"
          onClick={() => setBulkOpen((v) => !v)}
        >
          <ChevronDown className={cn("h-3 w-3 transition", bulkOpen && "rotate-180")} />
          Paste a list ({year} dates auto-assigned)
        </button>
        {bulkOpen && (
          <div className="mt-2 space-y-2">
            <textarea
              className={cn(fieldClass, "min-h-[88px] font-mono text-xs")}
              placeholder={"Facilities Master Plan\nCMMS Implementation\nTraining Program"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              disabled={saving}
            />
            <button
              type="button"
              disabled={saving || !bulkText.trim()}
              onClick={() => void addBulk()}
              className="w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-xs font-semibold text-ds-foreground hover:bg-ds-secondary disabled:opacity-50"
            >
              Add {bulkText.split("\n").filter((l) => l.trim()).length || 0} placeholders
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {ROADMAP_CATEGORIES.slice(0, 4).map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-ds-secondary/80 px-2 py-0.5 text-[9px] text-ds-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
