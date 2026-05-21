"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { arenaExtraRoutineNames, type ArenaSide } from "@/lib/schedule/arena-routine-catalog";
import { buttonVariants } from "@/styles/button-variants";
import type { RoutineRow } from "@/lib/routinesService";

type Props = {
  open: boolean;
  workerName: string;
  routines: RoutineRow[];
  defaultSide?: ArenaSide;
  onClose: () => void;
  onConfirm: (payload: {
    side: ArenaSide;
    comment: string | null;
    extraRoutineId: string | null;
  }) => void;
};

const FIELD =
  "mt-1.5 w-full rounded-md border border-ds-border bg-ds-secondary px-3 py-2 text-sm text-ds-foreground";

export function ScheduleRoutineExtraModal({
  open,
  workerName,
  routines,
  defaultSide = "a",
  onClose,
  onConfirm,
}: Props) {
  const [side, setSide] = useState<ArenaSide>(defaultSide);
  const [mode, setMode] = useState<"comment" | "routine">("comment");
  const [comment, setComment] = useState("");
  const [routineId, setRoutineId] = useState("");

  const extraOptions = useMemo(() => {
    const names = new Set(arenaExtraRoutineNames().map((n) => n.toLowerCase()));
    return routines.filter((r) => names.has(r.name.trim().toLowerCase()));
  }, [routines]);

  useEffect(() => {
    if (!open) return;
    setSide(defaultSide);
    setMode("comment");
    setComment("");
    setRoutineId(extraOptions[0]?.id ?? "");
  }, [open, defaultSide, extraOptions]);

  if (!open) return null;

  const canSubmit =
    mode === "comment" ? comment.trim().length > 0 : Boolean(routineId.trim());

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="routine-extra-title"
    >
      <div className="w-full max-w-md rounded-xl border border-ds-border bg-ds-primary p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="routine-extra-title" className="text-base font-semibold text-ds-foreground">
              Extra assignment
            </h2>
            <p className="mt-0.5 text-xs text-ds-muted">For {workerName}</p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-ds-muted hover:bg-ds-interactive-hover"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <fieldset className="mt-4">
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
            Arena
          </legend>
          <div className="mt-1.5 flex gap-2">
            {(["a", "b"] as ArenaSide[]).map((s) => (
              <button
                key={s}
                type="button"
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm font-semibold",
                  side === s
                    ? "border-[var(--ds-accent)] bg-[color-mix(in_srgb,var(--ds-accent)_12%,transparent)] text-ds-foreground"
                    : "border-ds-border text-ds-muted hover:bg-ds-interactive-hover",
                )}
                onClick={() => setSide(s)}
              >
                Arena {s.toUpperCase()}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
            Extra type
          </legend>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              className={cn(
                "flex-1 rounded-md border px-2 py-2 text-xs font-semibold",
                mode === "comment"
                  ? "border-amber-400/80 bg-amber-50/90 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                  : "border-ds-border text-ds-muted",
              )}
              onClick={() => setMode("comment")}
            >
              Describe task
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 rounded-md border px-2 py-2 text-xs font-semibold",
                mode === "routine"
                  ? "border-amber-400/80 bg-amber-50/90 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                  : "border-ds-border text-ds-muted",
              )}
              onClick={() => setMode("routine")}
            >
              Extra routine
            </button>
          </div>
        </fieldset>

        {mode === "comment" ? (
          <label className="mt-4 block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
              What will this extra cover?
            </span>
            <textarea
              className={cn(FIELD, "min-h-[88px]")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Cover south concourse during event load-in"
            />
          </label>
        ) : (
          <label className="mt-4 block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
              Extra routine
            </span>
            <select
              className={FIELD}
              value={routineId}
              onChange={(e) => setRoutineId(e.target.value)}
            >
              {extraOptions.length === 0 ? (
                <option value="">No extra routines — sync arena catalog first</option>
              ) : (
                extraOptions
                  .filter((r) => r.name.toLowerCase().includes(`arena ${side}`))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))
              )}
            </select>
          </label>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2 text-sm")}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2 text-sm")}
            disabled={!canSubmit}
            onClick={() => {
              onConfirm({
                side,
                comment: mode === "comment" ? comment.trim() : null,
                extraRoutineId: mode === "routine" ? routineId || null : null,
              });
            }}
          >
            Assign extra
          </button>
        </div>
      </div>
    </div>
  );
}
