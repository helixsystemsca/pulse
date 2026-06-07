"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { listKnowledgeBaseCaseStudies } from "@/lib/operational-improvements/api";
import type { OperationalImprovementCaseStudy } from "@/lib/operational-improvements/types";
import { CATEGORY_LABELS } from "@/lib/operational-improvements/labels";
import { cn } from "@/lib/cn";

const FIELD =
  "w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-primary dark:text-ds-foreground";

type Props = {
  onToast: (message: string) => void;
};

export function OperationalImprovementsKnowledgeBase({ onToast }: Props) {
  const [rows, setRows] = useState<OperationalImprovementCaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listKnowledgeBaseCaseStudies(q.trim() || undefined));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not load case studies.");
    } finally {
      setLoading(false);
    }
  }, [q, onToast]);

  useEffect(() => {
    const delay = q.trim() ? 280 : 0;
    const t = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(t);
  }, [q, refresh]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ds-muted">
        Completed improvements published to the knowledge base — searchable organizational learning from real operational fixes.
      </p>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" aria-hidden />
        <input
          className={cn(FIELD, "pl-9")}
          placeholder="Search case studies…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-ds-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ds-border px-4 py-10 text-center text-sm text-ds-muted">
          No published case studies yet. Publish completed improvements from the opportunity detail panel.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-ds-border bg-ds-primary p-4">
              <div className="flex flex-wrap items-center gap-2">
                {row.display_id ? (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ds-muted">{row.display_id}</span>
                ) : null}
                <span className="rounded-full bg-ds-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-ds-muted">
                  {CATEGORY_LABELS[row.category]}
                </span>
              </div>
              <h3 className="mt-1 text-base font-semibold text-ds-foreground">{row.title}</h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Problem</dt>
                  <dd className="mt-1 text-ds-foreground">{row.problem || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Root cause</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-ds-foreground">{row.root_cause || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Solution</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-ds-foreground">{row.solution || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Results</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-ds-foreground">{row.results || "—"}</dd>
                </div>
              </dl>
              {row.lessons_learned ? (
                <p className="mt-3 rounded-lg bg-ds-secondary/60 px-3 py-2 text-sm text-ds-foreground">
                  <span className="font-semibold">Lessons learned: </span>
                  {row.lessons_learned}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
