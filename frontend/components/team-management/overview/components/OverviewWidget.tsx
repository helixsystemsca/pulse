"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function OverviewWidget({
  title,
  children,
  className,
  action,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <article className={cn("ops-dash-inner-card flex flex-col p-4", className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ds-muted">{title}</h3>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </article>
  );
}
