"use client";

import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

export function LevelUpModal({
  open,
  oldLevel,
  newLevel,
  borders,
  onClose,
}: {
  open: boolean;
  oldLevel: number;
  newLevel: number;
  borders: string[];
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-ds-border bg-ds-primary p-6 shadow-2xl transition-transform duration-300 ease-out">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-ds-success">Level up</p>
        <h2 className="mt-2 text-center text-2xl font-extrabold text-ds-foreground">
          {oldLevel} → {newLevel}
        </h2>
        {borders.length ? (
          <p className="mt-3 text-center text-sm text-ds-muted">
            Unlocked borders: <span className="font-semibold text-ds-foreground">{borders.join(", ")}</span>
          </p>
        ) : (
          <p className="mt-3 text-center text-sm text-ds-muted">Keep up the great work.</p>
        )}
        <button type="button" className={cn(buttonVariants({ surface: "dark", intent: "accent" }), "mt-6 w-full py-2.5 text-sm font-bold")} onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
}
