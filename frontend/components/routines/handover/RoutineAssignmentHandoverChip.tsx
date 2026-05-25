"use client";

import { useState } from "react";
import { StickyNote } from "lucide-react";
import { cn } from "@/lib/cn";
import { readSession } from "@/lib/pulse-session";
import { managerOrAbove } from "@/lib/pulse-roles";
import {
  createAssignmentHandover,
  demoCreateHandover,
  demoListHandovers,
  demoResolveHandover,
  listAssignmentHandovers,
  resolveAssignmentHandover,
  handoverUsesLiveApi,
  type AssignmentHandoverContext,
  type AssignmentHandoverSummary,
  type HandoverNoteType,
} from "@/lib/routines/assignment-handover";
import { AssignmentHandoverModal } from "./AssignmentHandoverModal";
import { AssignmentHandoverHistoryModal } from "./AssignmentHandoverHistoryModal";

export type RoutineAssignmentChipModel = {
  assignmentId: string;
  name: string;
  primaryUserId: string;
  shiftId?: string | null;
  operationalArea?: string | null;
};

export function RoutineAssignmentHandoverChip({
  assignment,
  workerName,
  shiftWindow,
  summary,
  onHandoverChange,
  layout = "card",
}: {
  assignment: RoutineAssignmentChipModel;
  workerName: string;
  shiftWindow: string | null;
  summary?: AssignmentHandoverSummary;
  onHandoverChange?: () => void;
  /** `inline` — compact pill beside worker name (ops dashboard). */
  layout?: "card" | "inline";
}) {
  const session = readSession();
  const userId = session?.sub ?? "demo-user";
  const userName = session?.full_name ?? session?.email ?? "You";
  const isSupervisor = managerOrAbove(session);
  const canWrite =
    isSupervisor || assignment.primaryUserId === userId || assignment.assignmentId.startsWith("demo-");

  const [addOpen, setAddOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const total = summary?.total_count ?? 0;
  const open = summary?.open_count ?? 0;

  const context: AssignmentHandoverContext = {
    assignmentId: assignment.assignmentId,
    routineName: assignment.name,
    employeeName: workerName,
    shiftLabel: shiftWindow,
    operationalArea: assignment.operationalArea ?? assignment.name,
  };

  async function submitHandover(body: { content: string; note_type: HandoverNoteType }) {
    setSaving(true);
    try {
      if (handoverUsesLiveApi() && !assignment.assignmentId.startsWith("demo-")) {
        await createAssignmentHandover(assignment.assignmentId, {
          ...body,
          employee_name: workerName,
          operational_area: context.operationalArea,
          shift_label: shiftWindow,
        });
      } else {
        demoCreateHandover(assignment.assignmentId, context, body, userId, userName);
      }
      onHandoverChange?.();
    } finally {
      setSaving(false);
    }
  }

  async function loadHandovers() {
    if (handoverUsesLiveApi() && !assignment.assignmentId.startsWith("demo-")) {
      return listAssignmentHandovers(assignment.assignmentId);
    }
    return demoListHandovers(assignment.assignmentId);
  }

  async function resolveHandover(handoverId: string) {
    if (handoverUsesLiveApi() && !assignment.assignmentId.startsWith("demo-")) {
      await resolveAssignmentHandover(assignment.assignmentId, handoverId);
    } else {
      demoResolveHandover(assignment.assignmentId, handoverId);
    }
    onHandoverChange?.();
  }

  const viewLabel =
    total === 0
      ? null
      : total === 1
        ? "View handover"
        : `View ${total} handovers`;

  const inline = layout === "inline";

  return (
    <>
      <div
        className={cn(
          "group/chip relative border border-violet-200/80 bg-violet-50/90 dark:border-violet-500/30 dark:bg-violet-950/50",
          inline
            ? "inline-flex max-w-[11.5rem] min-w-0 items-center gap-0.5 rounded-md px-1.5 py-0.5"
            : "flex w-full min-w-[8.5rem] max-w-full flex-col gap-0.5 rounded-lg px-2 py-1.5",
        )}
      >
        {total > 0 && inline ? (
          <button
            type="button"
            className="absolute inset-0 z-0 rounded-md"
            aria-label={viewLabel ?? "View handovers"}
            onClick={() => setHistoryOpen(true)}
          />
        ) : null}
        <div
          className={cn(
            "relative z-[1] flex min-w-0 items-center gap-0.5",
            inline ? "flex-1" : "w-full items-start justify-between gap-1",
          )}
        >
          <span
            className={cn(
              "min-w-0 font-medium leading-snug text-violet-900 dark:text-violet-100",
              inline ? "flex-1 truncate text-[9px]" : "flex-1 text-[10px]",
            )}
            title={assignment.name}
          >
            {assignment.name}
          </span>
          {inline && open > 0 ? (
            <span
              className="shrink-0 rounded bg-amber-100 px-1 text-[8px] font-bold tabular-nums text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
              title={open === 1 ? "1 open handover item" : `${open} open handover items`}
            >
              {open}
            </span>
          ) : null}
          {canWrite ? (
            <button
              type="button"
              className={cn(
                "relative z-[2] inline-flex shrink-0 items-center justify-center rounded",
                "text-violet-700/70 transition-colors hover:bg-violet-200/60 hover:text-violet-900",
                "dark:text-violet-200/70 dark:hover:bg-violet-800/50 dark:hover:text-violet-50",
                inline ? "h-4 w-4" : "h-6 w-6 rounded-md",
              )}
              aria-label="Add handover note"
              title="Add handover note"
              onClick={() => setAddOpen(true)}
            >
              <StickyNote className={cn(inline ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>

        {total > 0 && !inline ? (
          <div className="flex flex-col items-center gap-0.5 pt-0.5">
            <button
              type="button"
              className="text-[10px] font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline"
              onClick={() => setHistoryOpen(true)}
            >
              {viewLabel}
            </button>
            {open > 0 ? (
              <span className="text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                {open === 1 ? "1 open item" : `${open} open items`}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <AssignmentHandoverModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        context={context}
        saving={saving}
        onSubmit={submitHandover}
      />

      <AssignmentHandoverHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        context={context}
        canResolve={isSupervisor}
        loadHandovers={loadHandovers}
        onResolve={resolveHandover}
      />
    </>
  );
}
