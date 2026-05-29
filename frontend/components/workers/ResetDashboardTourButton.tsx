"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";

import { resetWorkerDashboardTour } from "@/lib/workersService";
import { cn } from "@/lib/cn";

type ResetDashboardTourButtonProps = {
  userId: string;
  fullName?: string | null;
  companyId: string | null;
  className?: string;
};

/** Clears the user's dashboard overview tour on the server (runs again on their next visit). */
export function ResetDashboardTourButton({
  userId,
  fullName,
  companyId,
  className,
}: ResetDashboardTourButtonProps) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleReset = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (busy) return;
      const label = fullName?.trim() || "this person";
      if (
        !window.confirm(
          `Reset the initial dashboard tour for ${label}? They will see “Welcome to Panorama” again on Overview.`,
        )
      ) {
        return;
      }
      setBusy(true);
      setNotice(null);
      try {
        await resetWorkerDashboardTour(companyId, userId);
        setNotice("Dashboard tour reset");
        window.setTimeout(() => setNotice(null), 4000);
      } catch {
        setNotice("Could not reset tour");
        window.setTimeout(() => setNotice(null), 5000);
      } finally {
        setBusy(false);
      }
    },
    [busy, companyId, fullName, userId],
  );

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ds-border bg-ds-primary text-ds-foreground transition-colors hover:bg-ds-secondary disabled:opacity-50 dark:bg-ds-secondary"
        aria-label="Reset dashboard tour"
        title="Reset initial dashboard tour (Welcome to Panorama on Overview)"
        disabled={busy}
        onClick={(e) => void handleReset(e)}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <RotateCcw className="h-4 w-4 opacity-80" aria-hidden />
        )}
      </button>
      {notice ? (
        <span
          role="status"
          className="pointer-events-none absolute end-0 top-full z-10 mt-1 max-w-[14rem] whitespace-nowrap rounded-md border border-ds-border bg-ds-surface px-2 py-1 text-[10px] font-medium text-ds-foreground shadow-sm"
        >
          {notice}
        </span>
      ) : null}
    </span>
  );
}
