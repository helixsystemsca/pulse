"use client";

import { useEffect, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { listPlanningIdeaReviewers, requestPlanningIdeaApproval } from "@/lib/planning-ideas/api";
import type { PlanningIdeaReviewer, PlanningIdeaRow } from "@/lib/planning-ideas/types";

const FIELD =
  "mt-1.5 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ds-accent/30";

type Props = {
  open: boolean;
  idea: PlanningIdeaRow | null;
  onClose: () => void;
  onSubmitted: (result: { email_sent: boolean; review_url?: string | null; status: string }) => void;
};

export function PlanningIdeaApprovalRequestModal({ open, idea, onClose, onSubmitted }: Props) {
  const [reviewers, setReviewers] = useState<PlanningIdeaReviewer[]>([]);
  const [reviewerId, setReviewerId] = useState("");
  const [comments, setComments] = useState("");
  const [loadingReviewers, setLoadingReviewers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReviewerId("");
    setComments("");
    setErr(null);
    setLoadingReviewers(true);
    void listPlanningIdeaReviewers()
      .then(setReviewers)
      .catch(() => setErr("Could not load reviewers."))
      .finally(() => setLoadingReviewers(false));
  }, [open]);

  if (!open || !idea) return null;

  const selectedIdea = idea;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIdea) {
      return;
    }
    if (!reviewerId.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const result = await requestPlanningIdeaApproval(selectedIdea.id, {
        requested_to_user_id: reviewerId,
        comments: comments.trim() || null,
      });
      onSubmitted({
        email_sent: result.email_sent,
        review_url: result.review_url,
        status: result.status,
      });
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not send approval request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PulseDrawer open={open} onClose={onClose} title="Request approval">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4 p-4">
        <p className="text-sm text-ds-muted">
          Send <strong className="text-ds-foreground">{selectedIdea.title}</strong> to a manager for review before it can
          become a project.
        </p>

        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="approval-reviewer">
            Reviewer
          </label>
          <select
            id="approval-reviewer"
            className={FIELD}
            required
            value={reviewerId}
            disabled={loadingReviewers || busy}
            onChange={(e) => setReviewerId(e.target.value)}
          >
            <option value="">{loadingReviewers ? "Loading…" : "Select manager…"}</option>
            {reviewers.map((r) => (
              <option key={r.user_id} value={r.user_id}>
                {r.full_name} ({r.email})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="approval-comments">
            Message (optional)
          </label>
          <textarea
            id="approval-comments"
            className={FIELD}
            rows={4}
            value={comments}
            disabled={busy}
            placeholder="Context, urgency, or constraints for the reviewer…"
            onChange={(e) => setComments(e.target.value)}
          />
        </div>

        {err ? <p className="text-sm text-ds-danger">{err}</p> : null}

        <div className="flex gap-2 pt-2">
          <button type="button" className="flex-1 rounded-lg border border-ds-border px-4 py-2 text-sm font-semibold" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !reviewerId}
            className="flex-1 rounded-lg bg-ds-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send request"}
          </button>
        </div>
      </form>
    </PulseDrawer>
  );
}
