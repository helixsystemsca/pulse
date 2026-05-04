"use client";

import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/pulse/Card";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  fetchProjectSummaryStorageState,
  saveProjectSummaryDraft,
} from "@/features/project-summary/projectSummaryApi";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex items-center justify-center gap-2 px-5 py-2.5");
const SECONDARY_BTN = cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex items-center justify-center gap-2 px-4 py-2.5");

export type ProjectCloseoutTabProps = {
  projectId: string;
  canManageSummary: boolean;
};

export function ProjectCloseoutTab({ projectId, canManageSummary }: ProjectCloseoutTabProps) {
  const router = useRouter();
  const summaryHref = `/projects/${projectId}/summary`;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [hasFinalized, setHasFinalized] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const s = await fetchProjectSummaryStorageState(projectId);
      setHasDraft(s.has_draft);
      setHasFinalized(s.has_finalized);
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onGenerate() {
    if (!canManageSummary) return;
    setBusy(true);
    setErr(null);
    try {
      await saveProjectSummaryDraft(projectId, {});
      setHasDraft(true);
      router.push(summaryHref);
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  const showGenerate = !hasDraft && !hasFinalized;
  const showContinue = hasDraft;
  const showViewReport = hasFinalized;

  return (
    <div className="space-y-6">
      <Card padding="md" className="space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-ds-border bg-ds-secondary text-ds-success shadow-[var(--ds-shadow-card)]">
            <FileText className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-ds-foreground">Project closeout summary</h2>
            <p className="mt-1 text-sm text-ds-muted">
              Generate a structured summary from project data, capture lessons and outcome, and save drafts. Finalize
              from the summary page when ready.
            </p>
          </div>
        </div>

        {err ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
            {err}
          </p>
        ) : null}

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-ds-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Checking saved summary…
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {showGenerate ? (
              <button
                type="button"
                className={PRIMARY_BTN}
                disabled={busy || !canManageSummary}
                onClick={() => void onGenerate()}
                title={!canManageSummary ? "Only the project creator, owner, or a tenant administrator can generate." : undefined}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {busy ? "Generating…" : "Generate summary"}
              </button>
            ) : null}

            {showContinue ? (
              <Link href={summaryHref} className={cn(PRIMARY_BTN, "no-underline")}>
                Continue summary
              </Link>
            ) : null}

            {showViewReport ? (
              <Link href={summaryHref} className={cn(hasDraft ? SECONDARY_BTN : PRIMARY_BTN, "no-underline")}>
                View report
              </Link>
            ) : null}
          </div>
        )}

        {!loading && !canManageSummary && showGenerate ? (
          <p className="text-xs text-ds-muted">
            You can view an existing summary when one is available. Generating requires project creator, owner, or
            tenant administrator access.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
