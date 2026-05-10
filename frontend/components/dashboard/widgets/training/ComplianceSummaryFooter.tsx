import { CalendarRange } from "lucide-react";

import { cn } from "@/lib/cn";

export type ComplianceSummaryFooterProps = {
  totalSlots: number;
  className?: string;
  /** Show calendar icon row (dashboard variant) */
  showIconRow?: boolean;
  /** Tighter copy and spacing for scaled / narrow tiles */
  dense?: boolean;
};

export function ComplianceSummaryFooter({
  totalSlots,
  className,
  showIconRow = true,
  dense = false,
}: ComplianceSummaryFooterProps) {
  const total = Math.max(0, totalSlots);

  return (
    <div
      className={cn(
        "border-t border-black/[0.06] dark:border-white/[0.08]",
        dense ? "pt-2.5" : "pt-4",
        className,
      )}
    >
      <div className={cn("flex gap-2", dense ? "gap-2" : "gap-3")}>
        <span
          className={cn(
            "mt-0.5 w-1 shrink-0 rounded-full bg-gradient-to-b from-rose-400/90 to-rose-500/70 shadow-[0_0_12px_-2px_rgba(255,90,122,0.55)]",
            dense ? "h-8" : "h-10",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className={cn("font-semibold leading-snug text-ds-foreground", dense ? "text-xs" : "text-[13px]")}>
            Mandatory programs
          </p>
          <p className={cn("font-medium leading-snug text-ds-muted", dense ? "text-[10px] leading-relaxed" : "text-xs leading-relaxed")}>
            {dense ? (
              <>
                {total.toLocaleString()} mandatory slots (completed + expiring + gaps) for this tenant.
              </>
            ) : (
              <>
                {total.toLocaleString()} assignment slots (completed + expiring + gaps). Slots reflect active mandatory training
                matrix coverage for this tenant.
              </>
            )}
          </p>
        </div>
      </div>

      {showIconRow ? (
        <div className={cn("flex items-start gap-2 text-ds-muted", dense ? "mt-2 text-[10px]" : "mt-3 text-xs")}>
          <CalendarRange className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          <p className="leading-snug">Use the training matrix to close gaps before completions lapse.</p>
        </div>
      ) : null}
    </div>
  );
}
