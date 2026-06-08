"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { listOperationalImprovementPlaybooks } from "@/lib/operational-improvements/api";
import type { OperationalImprovementPlaybook } from "@/lib/operational-improvements/types";
import { CATEGORY_LABELS } from "@/lib/operational-improvements/labels";
import { cn } from "@/lib/cn";

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const FIELD =
  "w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2 text-sm shadow-sm dark:border-ds-border dark:bg-ds-primary dark:text-ds-foreground";

type Props = {
  onToast: (message: string) => void;
  onReference?: (playbookId: string) => void;
  selectable?: boolean;
};

export function OperationalImprovementsPlaybooks({ onToast, onReference, selectable }: Props) {
  const [rows, setRows] = useState<OperationalImprovementPlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listOperationalImprovementPlaybooks(q.trim() || undefined));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not load playbooks.");
    } finally {
      setLoading(false);
    }
  }, [q, onToast]);

  useEffect(() => {
    const t = window.setTimeout(() => void refresh(), q.trim() ? 280 : 0);
    return () => window.clearTimeout(t);
  }, [q, refresh]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ds-muted">
        Reusable playbooks from completed improvements — reference them when tackling similar friction.
      </p>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" aria-hidden />
        <input className={cn(FIELD, "pl-9")} placeholder="Search playbooks…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-ds-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ds-border px-4 py-8 text-center text-sm text-ds-muted">
          No playbooks yet. Convert a completed improvement from its detail panel.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-ds-border bg-ds-primary p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="rounded-full bg-ds-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-ds-muted">
                    {CATEGORY_LABELS[row.category as keyof typeof CATEGORY_LABELS] ?? row.category}
                  </span>
                  <h3 className="mt-1 font-semibold text-ds-foreground">{row.title}</h3>
                </div>
                {selectable && onReference ? (
                  <button type="button" className="text-sm font-semibold text-ds-accent hover:underline" onClick={() => onReference(row.id)}>
                    Reference
                  </button>
                ) : null}
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className={LABEL}>Problem</dt><dd className="mt-0.5">{row.problem || "—"}</dd></div>
                <div><dt className={LABEL}>Root cause</dt><dd className="mt-0.5 whitespace-pre-wrap">{row.root_cause || "—"}</dd></div>
                <div><dt className={LABEL}>Solution</dt><dd className="mt-0.5 whitespace-pre-wrap">{row.solution || "—"}</dd></div>
                <div><dt className={LABEL}>Results</dt><dd className="mt-0.5 whitespace-pre-wrap">{row.results || "—"}</dd></div>
              </dl>
              {row.lessons_learned ? <p className="mt-2 text-sm text-ds-muted"><span className="font-semibold">Lessons:</span> {row.lessons_learned}</p> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
