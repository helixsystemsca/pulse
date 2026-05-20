"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { AuthBrandLink } from "@/components/auth/AuthBrandLink";
import { dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import {
  fetchPublicPlanningApproval,
  respondPublicPlanningApproval,
} from "@/lib/planning-ideas/api";
import { formatEstimatedCost, PRIORITY_LABELS } from "@/lib/planning-ideas/labels";
import type { PublicPlanningApprovalPayload } from "@/lib/planning-ideas/types";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

function PlanningApprovalContent() {
  const search = useSearchParams();
  const token = search.get("token") || "";
  const intent = search.get("intent") || "";

  const [payload, setPayload] = useState<PublicPlanningApprovalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ decision: string; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setErr("Missing approval token in link.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchPublicPlanningApproval(token);
      setPayload(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load request.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(decision: "approve" | "reject") {
    if (!token || busy || payload?.already_responded) return;
    setBusy(true);
    setErr(null);
    try {
      const result = await respondPublicPlanningApproval({
        token,
        decision,
        reviewer_comments: comments.trim() || null,
      });
      setDone({ decision: result.decision, message: result.message });
      setPayload((p) => (p ? { ...p, already_responded: true, approval_status: decision === "approve" ? "approved" : "rejected" } : p));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save decision.");
    } finally {
      setBusy(false);
    }
  }

  const preselectApprove = intent === "approve";
  const preselectReject = intent === "reject";

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col items-center text-center">
        <AuthBrandLink />
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ds-muted">Planning intake</p>
      </div>

      {loading ? (
        <p className="text-center text-sm text-ds-muted">Loading request…</p>
      ) : err && !payload ? (
        <div className="rounded-xl border border-ds-danger/40 bg-ds-danger/10 px-4 py-6 text-center text-sm text-ds-danger">
          {err}
        </div>
      ) : payload ? (
        <div className="space-y-5 rounded-2xl border border-ds-border bg-ds-primary p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">{payload.company_name}</p>
            <h1 className="mt-1 text-xl font-semibold text-ds-foreground">{payload.title}</h1>
            <p className="mt-1 text-sm text-ds-muted">
              Requested by <strong className="text-ds-foreground">{payload.requester_name}</strong>
              {payload.requester_email ? ` · ${payload.requester_email}` : ""}
            </p>
          </div>

          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-ds-border/60 py-2">
              <dt className="text-ds-muted">Priority</dt>
              <dd className="font-medium">
                {PRIORITY_LABELS[payload.priority as keyof typeof PRIORITY_LABELS] ?? payload.priority}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-ds-border/60 py-2">
              <dt className="text-ds-muted">Est. cost</dt>
              <dd className="font-medium">{formatEstimatedCost(payload.estimated_cost)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-ds-border/60 py-2">
              <dt className="text-ds-muted">Location</dt>
              <dd className="font-medium text-right">{payload.location || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-ds-border/60 py-2">
              <dt className="text-ds-muted">Category</dt>
              <dd className="font-medium text-right">{payload.category || "—"}</dd>
            </div>
          </dl>

          {payload.description ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ds-foreground">{payload.description}</p>
            </div>
          ) : null}

          {payload.request_comments ? (
            <div className="rounded-lg bg-ds-secondary/40 px-3 py-2 text-sm">
              <p className="text-xs font-bold uppercase text-ds-muted">Requester notes</p>
              <p className="mt-1 text-ds-foreground">{payload.request_comments}</p>
            </div>
          ) : null}

          {done ? (
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-3 text-sm",
                done.decision === "approve"
                  ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                  : "bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100",
              )}
            >
              {done.decision === "approve" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              )}
              <p>{done.message}</p>
            </div>
          ) : payload.already_responded ? (
            <p className="text-center text-sm text-ds-muted">This request was already completed.</p>
          ) : (
            <>
              <div>
                <label className={dsLabelClass} htmlFor="reviewer-comments">
                  Your comments (optional)
                </label>
                <textarea
                  id="reviewer-comments"
                  className={cn(dsInputClass, "mt-1.5 min-h-[4.5rem]")}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Reasoning, conditions, or next steps…"
                />
              </div>
              {err ? <p className="text-sm text-ds-danger">{err}</p> : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={busy}
                  className={cn(
                    buttonVariants({ variant: "primary" }),
                    "flex-1 bg-emerald-600 hover:bg-emerald-700",
                    preselectApprove && !busy && "ring-2 ring-emerald-400 ring-offset-2",
                  )}
                  onClick={() => void submit("approve")}
                >
                  Approve idea
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={cn(
                    buttonVariants({ variant: "secondary" }),
                    "flex-1 border-rose-300 text-rose-800 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-200",
                    preselectReject && !busy && "ring-2 ring-rose-400 ring-offset-2",
                  )}
                  onClick={() => void submit("reject")}
                >
                  Reject
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <p className="mt-8 text-center text-xs text-ds-muted">
        You can close this page when finished. No sign-in required for email approvals.
      </p>
    </main>
  );
}

export default function PlanningApprovalPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-ds-muted">Loading…</p>}>
      <PlanningApprovalContent />
    </Suspense>
  );
}
