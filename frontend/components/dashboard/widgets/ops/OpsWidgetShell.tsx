"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Shared chrome for facility-style operations widgets (neutral header + soft inner well).
 */
export function OpsWidgetShell({
  title,
  headerRight,
  children,
  className,
  /** Override inner well padding (e.g. `p-0` for full-bleed widget bodies). */
  bodyClassName,
}: {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("ops-dash-widget flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div className="ops-dash-widget-header flex shrink-0 items-center justify-between gap-1.5 px-2 py-1">
        <p className="ops-widget-shell-title min-w-0 flex-1 truncate">{title}</p>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      <div className={cn("ops-dash-widget-body min-h-0 flex-1 overflow-auto ds-scroll px-2 py-1", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}
