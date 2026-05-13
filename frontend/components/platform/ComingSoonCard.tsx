import type { ReactNode } from "react";

type ComingSoonCardProps = {
  title: string;
  description: string;
  footer?: ReactNode;
};

export function ComingSoonCard({ title, description, footer }: ComingSoonCardProps) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-ds-border bg-ds-primary p-6 shadow-[var(--ds-shadow-card)]">
      <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">Coming soon</p>
      <h2 className="mt-2 font-body text-xl font-bold text-ds-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ds-muted">{description}</p>
      {footer ? <div className="mt-4 border-t border-ds-border pt-4">{footer}</div> : null}
    </div>
  );
}
