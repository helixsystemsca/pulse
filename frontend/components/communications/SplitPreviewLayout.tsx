import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SplitPreviewLayoutProps = {
  leftTitle: string;
  rightTitle: string;
  left: ReactNode;
  right: ReactNode;
  className?: string;
  /** Flat right pane — full-width editorial preview without nested card chrome. */
  flatRight?: boolean;
};

export function SplitPreviewLayout({
  leftTitle,
  rightTitle,
  left,
  right,
  className,
  flatRight = false,
}: SplitPreviewLayoutProps) {
  return (
    <div
      className={cn(
        "grid w-full min-w-0 gap-4 lg:grid-cols-2 lg:gap-6 lg:divide-x lg:divide-ds-border",
        className,
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ds-muted">{leftTitle}</p>
        <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border border-ds-border bg-ds-secondary/30 p-3">
          {left}
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ds-muted">{rightTitle}</p>
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-auto",
            flatRight
              ? "w-full max-w-none p-0"
              : "rounded-xl border border-ds-border bg-ds-primary p-3 shadow-inner",
          )}
        >
          {right}
        </div>
      </div>
    </div>
  );
}
