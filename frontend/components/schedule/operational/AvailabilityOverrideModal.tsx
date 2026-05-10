"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

export function AvailabilityOverrideModal({
  open,
  workerName,
  detail,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  workerName: string;
  detail: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-w-md rounded-xl border border-pulseShell-border bg-pulseShell-surface p-5 shadow-xl">
        <h2 className="text-base font-bold text-ds-foreground">Override availability?</h2>
        <p className="mt-2 text-sm text-ds-muted">
          <span className="font-semibold text-ds-foreground">{workerName}</span> is constrained for this placement.
        </p>
        <p className="mt-1 text-sm text-ds-foreground">{detail}</p>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="override-reason">
          Reason (required for audit log)
        </label>
        <textarea
          id="override-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-pulseShell-border bg-pulseShell-elevated px-3 py-2 text-sm text-ds-foreground"
          placeholder="Why is this assignment authorized?"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2")} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2")}
            disabled={reason.trim().length < 4}
            onClick={() => {
              onConfirm(reason.trim());
              setReason("");
            }}
          >
            Confirm override
          </button>
        </div>
      </div>
    </div>
  );
}
