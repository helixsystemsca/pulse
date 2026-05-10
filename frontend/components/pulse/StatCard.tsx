import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "./Card";

type StatBlockProps = {
  label: string;
  /** Semantic emphasis — maps to design tokens */
  tone?: "neutral" | "success" | "danger" | "warning";
};

export function StatBlock({ label, tone = "neutral" }: StatBlockProps) {
  const tones = {
    neutral: "border-ds-border bg-ds-secondary text-ds-foreground",
    success: "border-[color-mix(in_srgb,var(--ds-success)_35%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-success)_12%,var(--ds-surface-primary))] text-ds-foreground",
    danger: "border-[color-mix(in_srgb,var(--ds-danger)_35%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-danger)_12%,var(--ds-surface-primary))] text-ds-foreground",
    warning: "border-[color-mix(in_srgb,var(--ds-warning)_35%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-warning)_12%,var(--ds-surface-primary))] text-ds-foreground",
  } as const;

  return (
    <div className={`rounded-md border px-3 py-2.5 text-center text-xs font-semibold leading-snug sm:text-sm ${tones[tone]}`}>
      {label}
    </div>
  );
}

type StatCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function StatCard({ icon: Icon, title, subtitle, children, className = "" }: StatCardProps) {
  return (
    <Card className={className} variant="primary" padding="lg">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-ds-border bg-ds-secondary text-ds-accent">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold text-ds-foreground sm:text-base">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-ds-muted sm:text-sm">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </Card>
  );
}
