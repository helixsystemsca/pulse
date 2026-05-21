"use client";

import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import {
  WorkRequestCreateSubmitButton,
  type WorkRequestCreateSubmitPhase,
} from "@/components/work-requests/WorkRequestCreateSubmitButton";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-ds-border bg-ds-secondary px-3 py-2.5 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)]";
const SECONDARY_BTN = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2");

export type WorkRequestReviewWorker = {
  id: string;
  full_name?: string | null;
  email: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  workItemLabel: string;
  title: string;
  description?: string | null;
  workers: WorkRequestReviewWorker[];
  assigneeId: string;
  onAssigneeChange: (userId: string) => void;
  submitPhase: WorkRequestCreateSubmitPhase;
  onApprove: () => void;
  onReject: () => void;
  rejectBusy?: boolean;
};

export function WorkRequestReviewModal({
  open,
  onClose,
  workItemLabel,
  title,
  description,
  workers,
  assigneeId,
  onAssigneeChange,
  submitPhase,
  onApprove,
  onReject,
  rejectBusy = false,
}: Props) {
  const pending = submitPhase === "loading" || submitPhase === "success";

  return (
    <PulseDrawer
      open={open}
      onClose={onClose}
      title="Review work request"
      subtitle="Approve and assign a worker in one step"
      placement="center"
      labelledBy="wr-review-title"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className={cn(
              SECONDARY_BTN,
              "border-rose-200 text-rose-800 hover:bg-rose-50 dark:border-rose-500/35 dark:text-rose-100 dark:hover:bg-rose-950/40",
            )}
            disabled={pending || rejectBusy}
            onClick={onReject}
          >
            {rejectBusy ? "Rejecting…" : "Reject"}
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-pulse-muted hover:text-pulse-navy disabled:opacity-50 dark:hover:text-gray-100"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </button>
            <WorkRequestCreateSubmitButton
              phase={submitPhase}
              disabled={!assigneeId.trim()}
              idleLabel="Approve"
              loadingLabel="Approving"
              successSrLabel="Approved and assigned"
              onClick={onApprove}
            />
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p id="wr-review-title" className="sr-only">
          Review work request
        </p>
        <div className="rounded-lg border border-ds-border bg-ds-secondary/40 px-3 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">{workItemLabel}</p>
          <p className="mt-1 text-sm font-semibold text-ds-foreground">{title}</p>
          {description?.trim() ? (
            <p className="mt-2 text-sm text-ds-muted">{description.trim()}</p>
          ) : null}
        </div>

        <div>
          <label className={LABEL} htmlFor="wr-review-assignee">
            Assign to <span className="text-red-600 dark:text-red-400">*</span>
          </label>
          <select
            id="wr-review-assignee"
            className={FIELD}
            value={assigneeId}
            onChange={(e) => onAssigneeChange(e.target.value)}
            disabled={pending}
          >
            <option value="">Select worker…</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.full_name?.trim() ? `${w.full_name} (${w.email})` : w.email}
              </option>
            ))}
          </select>
          {workers.length === 0 ? (
            <p className="mt-2 text-xs text-ds-muted">No workers loaded. Refresh the page or check company context.</p>
          ) : null}
          <p className="mt-2 text-xs text-ds-muted">
            The request stays open until the assignee starts work. Reject sends it to closed/cancelled.
          </p>
        </div>
      </div>
    </PulseDrawer>
  );
}
