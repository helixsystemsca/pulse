"use client";

import { AlertTriangle, CheckCircle, Loader2, Users, X } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export type DraftAssignment = {
  slot_date: string;
  slot_start_min: number;
  slot_end_min: number;
  slot_shift_type: string;
  shift_definition_id: string | null;
  shift_code: string | null;
  facility_id: string | null;
  user_id: string;
  user_name: string;
  score: number;
  warnings: string[];
};

export type DraftConflict = {
  slot_date: string;
  slot_start_min: number;
  slot_shift_type: string;
  reason: string;
};

export type DraftResult = {
  assignments: DraftAssignment[];
  conflicts: DraftConflict[];
  total_slots: number;
};

function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Props = {
  draft: DraftResult;
  companyId: string | null;
  onCommit: () => void;
  onDiscard: () => void;
};

export function ScheduleDraftPanel({ draft, companyId, onCommit, onDiscard }: Props) {
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCommit = async () => {
    setCommitting(true);
    setError(null);
    try {
      const url = companyId
        ? `/api/v1/pulse/schedule/draft/commit?company_id=${encodeURIComponent(companyId)}`
        : "/api/v1/pulse/schedule/draft/commit";
      await apiFetch(url, {
        method: "POST",
        json: { assignments: draft.assignments },
      });
      setCommitted(true);
      onCommit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to commit draft");
    } finally {
      setCommitting(false);
    }
  };

  if (committed) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
        <div>
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            {draft.assignments.length} shifts created
          </p>
          <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
            Schedule updated — refresh to see all shifts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-ds-border bg-ds-primary shadow-sm">
      <div className="flex items-center justify-between border-b border-ds-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-ds-accent" />
          <span className="text-sm font-bold text-ds-foreground">
            Draft — {draft.assignments.length} of {draft.total_slots} slots filled
          </span>
        </div>
        <button type="button" onClick={onDiscard} className="text-ds-muted hover:text-ds-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {draft.conflicts.length > 0 && (
        <div className="border-b border-ds-border bg-amber-50/50 px-4 py-3 dark:bg-amber-950/20">
          <div className="mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">
              {draft.conflicts.length} conflict{draft.conflicts.length !== 1 ? "s" : ""} need attention
            </span>
          </div>
          <ul className="space-y-1">
            {draft.conflicts.map((c, i) => (
              <li key={i} className="text-xs text-amber-800 dark:text-amber-200">
                <span className="font-semibold">
                  {c.slot_date} · {c.slot_shift_type}
                </span>
                {" — "}
                {c.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="max-h-56 overflow-y-auto px-4 py-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ds-muted">Assigned shifts</p>
        <ul className="space-y-1.5">
          {draft.assignments.map((a, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-ds-foreground">{a.user_name}</span>
              <span className="text-ds-muted">
                {a.slot_date}
                {a.shift_code ? <span className="ml-1 font-bold text-ds-accent">{a.shift_code}</span> : null}{" "}
                {minToTime(a.slot_start_min)}–{minToTime(a.slot_end_min)}
              </span>
              {a.warnings.length > 0 ? (
                <span className="text-amber-500" title={a.warnings.join(", ")}>
                  ⚠
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {error ? <p className="px-4 pb-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex items-center justify-end gap-2 border-t border-ds-border px-4 py-3">
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex items-center gap-1.5 rounded-md border border-ds-border bg-ds-primary px-3 py-1.5 text-xs font-semibold text-ds-muted hover:text-ds-foreground"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={() => void handleCommit()}
          disabled={committing || draft.assignments.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-ds-accent px-4 py-1.5 text-xs font-bold text-ds-accent-foreground hover:bg-ds-accent/90 disabled:opacity-60"
        >
          {committing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {committing ? "Creating…" : `Accept ${draft.assignments.length} shifts`}
        </button>
      </div>
    </div>
  );
}
