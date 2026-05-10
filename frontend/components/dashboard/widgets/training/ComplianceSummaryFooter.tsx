import { CalendarRange } from "lucide-react";

import { cn } from "@/lib/cn";

export type ComplianceSummaryFooterProps = {
  totalSlots: number;
  className?: string;
  /** Show calendar icon row (dashboard variant) */
  showIconRow?: boolean;
};

export function ComplianceSummaryFooter({ totalSlots, className, showIconRow = true }: ComplianceSummaryFooterProps) {
  const total = Math.max(0, totalSlots);

  return (
    <div className={cn("border-t border-black/[0.06] pt-4 dark:border-white/[0.08]", className)}>
      <div className="flex gap-3">
        <span
          className="mt-0.5 h-10 w-1 shrink-0 rounded-full bg-gradient-to-b from-rose-400/90 to-rose-500/70 shadow-[0_0_12px_-2px_rgba(255,90,122,0.55)]"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[13px] font-semibold leading-snug text-ds-foreground">Mandatory programs</p>
          <p className="text-xs font-medium leading-relaxed text-ds-muted">
            {total.toLocaleString()} assignment slots (completed + expiring + gaps). Slots reflect active mandatory training
            matrix coverage for this tenant.
          </p>
        </div>
      </div>

      {showIconRow ? (
        <div className="mt-3 flex items-start gap-2 text-xs text-ds-muted">
          <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-ds-muted opacity-80" aria-hidden />
          <p className="leading-snug">
            Use the training matrix to close gaps and renew expiring completions before they lapse.
          </p>
        </div>
      ) : null}
    </div>
  );
}
