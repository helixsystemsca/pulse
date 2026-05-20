import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SplitPreviewLayoutProps = {
  leftTitle: string;
  rightTitle: string;
  left: ReactNode;
  right: ReactNode;
  className?: string;
};

/** Shared outer frame for each comparison pane (symmetrical split QA). */
const COMPARISON_PANE_CLASS =
  "min-h-[min(280px,50vh)] min-w-0 w-full flex-1 overflow-auto rounded-xl border border-ds-border bg-ds-secondary/30 p-3";

export function SplitPreviewLayout({ leftTitle, rightTitle, left, right, className }: SplitPreviewLayoutProps) {
  return (
    <div
      className={cn(
        "grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch",
        className,
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ds-muted">{leftTitle}</p>
        <div className={COMPARISON_PANE_CLASS}>{left}</div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ds-muted">{rightTitle}</p>
        <div className={COMPARISON_PANE_CLASS}>{right}</div>
      </div>
    </div>
  );
}
