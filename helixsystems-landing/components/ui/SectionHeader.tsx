import type { ReactNode } from "react";

export function SectionHeader({
  title,
  description,
  actions,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ds-muted">{title}</h2>
        {description ? <div className="mt-1 text-sm text-ds-muted">{description}</div> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
