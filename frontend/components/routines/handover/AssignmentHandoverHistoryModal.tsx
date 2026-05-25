"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PremiumModal } from "@/components/ui/premium-modal";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import {
  HANDOVER_NOTE_TYPE_LABELS,
  type AssignmentHandover,
  type AssignmentHandoverContext,
} from "@/lib/routines/assignment-handover";

function formatHandoverWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

function statusTone(noteType: AssignmentHandover["note_type"], resolved: boolean): string {
  if (resolved) return "bg-slate-100 text-slate-600 ring-slate-200/80 dark:bg-slate-800/60 dark:text-slate-300";
  if (noteType === "safety_concern") return "bg-rose-500/10 text-rose-900 ring-rose-200/60 dark:text-rose-100";
  if (noteType === "maintenance_concern") return "bg-amber-500/10 text-amber-900 ring-amber-200/60 dark:text-amber-100";
  if (noteType === "follow_up_required" || noteType === "incomplete") {
    return "bg-sky-500/10 text-sky-900 ring-sky-200/60 dark:text-sky-100";
  }
  return "bg-emerald-500/10 text-emerald-900 ring-emerald-200/60 dark:text-emerald-100";
}

export function AssignmentHandoverHistoryModal({
  open,
  onClose,
  context,
  canResolve,
  loadHandovers,
  onResolve,
}: {
  open: boolean;
  onClose: () => void;
  context: AssignmentHandoverContext;
  canResolve: boolean;
  loadHandovers: () => Promise<AssignmentHandover[]>;
  onResolve: (handoverId: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<AssignmentHandover[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await loadHandovers();
      setRows(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load handovers.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loadHandovers]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title="Handover history"
      subtitle={context.routineName}
      size="lg"
    >
      <div className="space-y-3">
        <p className="text-xs text-ds-muted">
          {context.employeeName}
          {context.shiftLabel ? ` · ${context.shiftLabel}` : ""}
        </p>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-ds-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : null}
        {err ? <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{err}</p> : null}

        {!loading && rows.length === 0 ? (
          <p className="text-sm text-ds-muted">No handover notes yet for this assignment.</p>
        ) : null}

        <ul className="max-h-[min(24rem,50vh)] space-y-3 overflow-y-auto pr-1">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-ds-border/70 bg-[color-mix(in_srgb,var(--ds-surface)_90%,transparent)] px-3 py-2.5 backdrop-blur-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ds-foreground">
                    {row.author_display ?? "Operator"}
                  </p>
                  <p className="text-[11px] text-ds-muted">{formatHandoverWhen(row.created_at)}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1",
                    statusTone(row.note_type, row.is_resolved),
                  )}
                >
                  {row.is_resolved ? "Resolved" : HANDOVER_NOTE_TYPE_LABELS[row.note_type]}
                </span>
              </div>
              {row.operational_area ? (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ds-muted">
                  {row.operational_area}
                </p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ds-foreground">
                &ldquo;{row.content}&rdquo;
              </p>
              {canResolve && !row.is_resolved && row.note_type !== "informational" ? (
                <button
                  type="button"
                  disabled={resolvingId === row.id}
                  className={cn(
                    buttonVariants({ surface: "light", intent: "secondary" }),
                    "mt-2 px-3 py-1.5 text-xs",
                  )}
                  onClick={() => {
                    setResolvingId(row.id);
                    void onResolve(row.id)
                      .then(() => refresh())
                      .finally(() => setResolvingId(null));
                  }}
                >
                  {resolvingId === row.id ? "Resolving…" : "Mark resolved"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </PremiumModal>
  );
}
