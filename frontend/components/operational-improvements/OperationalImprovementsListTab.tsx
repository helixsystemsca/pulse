"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { OperationalImprovementFormModal } from "@/components/operational-improvements/OperationalImprovementFormModal";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  priorityBadgeClass,
  statusBadgeClass,
} from "@/lib/operational-improvements/labels";
import {
  createOperationalImprovement,
  listOperationalImprovements,
} from "@/lib/operational-improvements/api";
import type { OperationalImprovementListRow } from "@/lib/operational-improvements/types";
import { OI_CATEGORIES, OI_STATUSES } from "@/lib/operational-improvements/types";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex items-center gap-2 px-3 py-2 text-sm font-bold");
const FIELD =
  "w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-primary dark:text-ds-foreground";

type Props = {
  onSelect: (row: OperationalImprovementListRow) => void;
  onToast: (message: string) => void;
  canManage: boolean;
};

export function OperationalImprovementsListTab({ onSelect, onToast, canManage }: Props) {
  const [rows, setRows] = useState<OperationalImprovementListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listOperationalImprovements({
        q: q.trim() || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      });
      setRows(data);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not load improvements.");
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, categoryFilter, onToast]);

  useEffect(() => {
    const delay = q.trim() ? 280 : 0;
    const t = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(t);
  }, [q, statusFilter, categoryFilter, refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" aria-hidden />
          <input
            className={cn(FIELD, "pl-9")}
            placeholder="Search opportunities…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {canManage ? (
          <button type="button" className={PRIMARY} onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New opportunity
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <select className={cn(FIELD, "w-auto min-w-[140px]")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {OI_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className={cn(FIELD, "w-auto min-w-[160px]")} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {OI_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-ds-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ds-border px-4 py-10 text-center text-sm text-ds-muted">
          No improvement opportunities yet.{canManage ? " Log friction you see in daily operations." : ""}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row)}
              className="flex w-full flex-col gap-2 rounded-xl border border-ds-border bg-ds-primary p-4 text-left transition hover:border-ds-accent/40 hover:shadow-sm sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {row.display_id ? (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ds-muted">{row.display_id}</span>
                  ) : null}
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", statusBadgeClass(row.status))}>
                    {STATUS_LABELS[row.status]}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", priorityBadgeClass(row.priority))}>
                    {PRIORITY_LABELS[row.priority]}
                  </span>
                </div>
                <h3 className="mt-1 font-semibold text-ds-foreground">{row.title}</h3>
                {row.description ? <p className="mt-1 line-clamp-2 text-sm text-ds-muted">{row.description}</p> : null}
                <p className="mt-2 text-xs text-ds-muted">
                  {CATEGORY_LABELS[row.category]}
                  {row.location ? ` · ${row.location}` : ""}
                  {row.estimated_impact ? ` · ${row.estimated_impact}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-xs text-ds-muted sm:text-right">
                <p>{row.analysis_count} analyses</p>
                <p>{row.action_count} actions</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <OperationalImprovementFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (draft) => {
          const created = await createOperationalImprovement(draft);
          onToast("Opportunity logged.");
          setFormOpen(false);
          await refresh();
          onSelect({
            ...created,
            action_count: created.actions.length,
            analysis_count: created.analyses.length,
          });
        }}
      />
    </div>
  );
}
