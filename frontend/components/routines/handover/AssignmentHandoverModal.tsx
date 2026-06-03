"use client";

import { useEffect, useState } from "react";
import { PremiumModal } from "@/components/ui/premium-modal";
import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import { useAsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import {
  HANDOVER_NOTE_TYPES,
  HANDOVER_NOTE_TYPE_LABELS,
  type AssignmentHandoverContext,
  type HandoverNoteType,
} from "@/lib/routines/assignment-handover";

const FIELD =
  "mt-1 w-full rounded-[10px] border border-ds-border bg-ds-secondary/80 px-3 py-2 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ds-accent)_35%,transparent)]";
const LABEL = "text-[10px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]";

export function AssignmentHandoverModal({
  open,
  onClose,
  context,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  context: AssignmentHandoverContext;
  onSubmit: (body: { content: string; note_type: HandoverNoteType }) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<HandoverNoteType>("informational");
  const { phase: submitPhase, run: runSubmit } = useAsyncSubmitPhase();
  const submitPending = submitPhase === "loading" || submitPhase === "success";

  useEffect(() => {
    if (!open) return;
    setContent("");
    setNoteType("informational");
  }, [open]);

  async function handleDone() {
    const text = content.trim();
    if (!text || submitPending) return;
    try {
      await runSubmit(async () => {
        await onSubmit({ content: text, note_type: noteType });
      });
      onClose();
    } catch {
      /* error animation */
    }
  }

  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title="Assignment handover"
      subtitle="Shift continuity note for the next operator"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <button
            type="button"
            className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2 text-sm")}
            onClick={onClose}
            disabled={submitPending}
          >
            Cancel
          </button>
          <AsyncSubmitButton
            phase={submitPhase}
            idleLabel="Done"
            loadingLabel="Saving"
            showSuccessLabel
            successLabel="Saved"
            disabled={submitPending || !content.trim()}
            onClick={() => void handleDone()}
            className="px-4 py-2 text-sm font-bold"
            minWidth="min-w-[7rem]"
          />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-ds-border/80 bg-[color-mix(in_srgb,var(--ds-surface)_88%,transparent)] px-3 py-2.5 text-sm backdrop-blur-sm">
          <p className="font-semibold text-ds-foreground">{context.routineName}</p>
          <p className="mt-1 text-xs text-ds-muted">
            {context.employeeName}
            {context.shiftLabel ? ` · ${context.shiftLabel}` : ""}
            {context.operationalArea ? ` · ${context.operationalArea}` : ""}
          </p>
        </div>

        <div>
          <label className={LABEL} htmlFor="handover-status">
            Status
          </label>
          <select
            id="handover-status"
            className={FIELD}
            value={noteType}
            onChange={(e) => setNoteType(e.target.value as HandoverNoteType)}
          >
            {HANDOVER_NOTE_TYPES.map((t) => (
              <option key={t} value={t}>
                {HANDOVER_NOTE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="handover-note">
            Handover note
          </label>
          <textarea
            id="handover-note"
            rows={5}
            className={cn(FIELD, "resize-y min-h-[6rem]")}
            placeholder="What should the next shift know?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </div>
    </PremiumModal>
  );
}
