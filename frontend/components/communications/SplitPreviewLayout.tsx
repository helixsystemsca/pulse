import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SplitPreviewLayoutProps = {
  leftTitle: string;
  rightTitle: string;
  left: ReactNode;
  right: ReactNode;
  className?: string;
};

export function SplitPreviewLayout({ leftTitle, rightTitle, left, right, className }: SplitPreviewLayoutProps) {
  return (
    <div
      className={cn(
        "grid min-h-[280px] gap-4 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-ds-border",
        className,
      )}
    >
      <div className="flex min-h-0 flex-col lg:pr-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ds-muted">{leftTitle}</p>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-ds-border bg-ds-secondary/30 p-3">{left}</div>
      </div>
      <div className="flex min-h-0 flex-col lg:pl-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ds-muted">{rightTitle}</p>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-ds-border bg-ds-primary p-3 shadow-inner">
          {right}
        </div>
      </div>
    </div>
  );
}
