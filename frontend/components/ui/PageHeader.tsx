"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  description?: string;
  /** Every feature page should pass a distinct icon for quick scanability. */
  icon: LucideIcon;
  actions?: ReactNode;
  /** When true, draws a subtle rule under the header block. */
  divider?: boolean;
  className?: string;
};

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  divider = true,
  className = "",
}: PageHeaderProps) {
  return (
    <div id="page-header" className={`space-y-4 ${className}`.trim()}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3 sm:gap-4">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ds-border bg-ds-secondary text-ds-success shadow-[var(--ds-shadow-card)]"
            aria-hidden
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h1 className="font-body text-xl font-bold tracking-tight text-ds-foreground md:text-2xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ds-muted">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {divider ? <hr className="app-page-divider" /> : null}
    </div>
  );
}
