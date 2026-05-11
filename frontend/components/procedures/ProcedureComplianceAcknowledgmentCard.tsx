"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  fetchProcedureLightCompletion,
  postProcedureLightCompletion,
  type ProcedureLightCompletionState,
} from "@/lib/procedureLightCompletion";
import { buttonVariants } from "@/styles/button-variants";
import { parseClientApiError } from "@/lib/parse-client-api-error";

type Props = {
  procedureId: string;
  isCritical: boolean;
  /** Current procedure content revision (for display). */
  contentRevision: number;
  onRecorded?: () => void;
  onError?: (message: string) => void;
};

function formatCompletedAt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function ProcedureComplianceAcknowledgmentCard({
  procedureId,
  isCritical,
  contentRevision,
  onRecorded,
  onError,
}: Props) {
  const [state, setState] = useState<ProcedureLightCompletionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [primary, setPrimary] = useState(false);
  const [secondary, setSecondary] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchProcedureLightCompletion(procedureId);
      setState(s);
      setPrimary(false);
      setSecondary(false);
    } catch (e) {
      onError?.(parseClientApiError(e).message);
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [procedureId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canSubmit = primary && (!isCritical || secondary);
  const showForm =
    state &&
    (state.status === "not_started" || state.status === "expired" || state.status === "requires_retraining");

  const onComplete = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const next = await postProcedureLightCompletion(procedureId, {
        primary_acknowledged: true,
        secondary_acknowledged: secondary,
      });
      setState(next);
      setPrimary(false);
      setSecondary(false);
      onRecorded?.();
    } catch (e) {
      onError?.(parseClientApiError(e).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !state) {
    return (
      <div className="rounded-xl border border-ds-border/90 bg-white px-4 py-6 text-center shadow-sm dark:border-ds-border dark:bg-ds-secondary">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-ds-muted" aria-hidden />
        <p className="mt-2 text-xs text-ds-muted">Loading completion status…</p>
      </div>
    );
  }

  if (!state) return null;

  const completedFresh = state.status === "completed";
  const completedRev = state.completed_revision_number ?? contentRevision;

  return (
    <div className="space-y-3">
      {completedFresh ? (
        <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-3 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Completed</p>
          <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-200/90">
            Completed on {formatCompletedAt(state.completed_at)}
          </p>
          <p className="mt-0.5 text-[11px] tabular-nums text-emerald-800/75 dark:text-emerald-200/75">
            Version {completedRev}
          </p>
        </div>
      ) : null}

      {showForm ? (
        <div className="rounded-xl border border-ds-border/90 bg-white px-4 py-4 shadow-sm dark:border-ds-border dark:bg-ds-secondary">
          <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Training completion</p>
          <p className="mt-1 text-[11px] leading-snug text-ds-muted">
            Record that you have reviewed this procedure for your assigned duties. This updates your training matrix when
            this procedure is assigned to you.
          </p>
          <label className="mt-3 flex cursor-pointer gap-2 text-sm leading-snug text-ds-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-ds-border"
              checked={primary}
              onChange={(e) => setPrimary(e.target.checked)}
            />
            <span>
              I acknowledge that I have reviewed and understood this procedure and agree to follow it as part of my
              assigned duties.
            </span>
          </label>
          {isCritical ? (
            <label className="mt-2 flex cursor-pointer gap-2 text-sm leading-snug text-ds-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-ds-border"
                checked={secondary}
                onChange={(e) => setSecondary(e.target.checked)}
              />
              <span>
                I understand that if I have questions or encounter conditions not covered in this procedure, I must
                notify a supervisor before proceeding.
              </span>
            </label>
          ) : (
            <label className="mt-2 flex cursor-pointer gap-2 text-sm leading-snug text-ds-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-ds-border"
                checked={secondary}
                onChange={(e) => setSecondary(e.target.checked)}
              />
              <span className="text-ds-muted">
                If unsure, I will notify a supervisor before proceeding{" "}
                <span className="text-[10px] font-semibold uppercase text-ds-muted">(optional)</span>
              </span>
            </label>
          )}

          <div
            className={cn(
              "mt-4 flex justify-end border-t border-ds-border/80 pt-3",
              "sm:static sm:bg-transparent sm:px-0 sm:pb-0",
              "sticky bottom-0 -mx-4 -mb-4 bg-white/95 px-4 pb-4 pt-3 backdrop-blur-sm dark:bg-ds-secondary/95 sm:mx-0 sm:mb-0",
            )}
          >
            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={() => void onComplete()}
              className={cn(
                buttonVariants({ surface: "light", intent: "accent" }),
                "min-h-[44px] px-5 py-2.5 text-sm font-semibold disabled:opacity-50",
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {submitting ? "Saving…" : "Complete procedure"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
