import type { ReactNode } from "react";
import { Card } from "@/components/pulse/Card";

const borderAccentClass = {
  success: "border-l-4 border-l-ds-success",
  warning: "border-l-4 border-l-ds-warning",
  danger: "border-l-4 border-l-ds-danger",
  neutral: "border-l-4 border-l-ds-border",
  info: "border-l-4 border-l-ds-success",
} as const;

export type MetricCardAccent = keyof typeof borderAccentClass;

export function MetricCard({
  label,
  value,
  hint,
  badge,
  borderAccent = "neutral",
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  badge?: ReactNode;
  borderAccent?: MetricCardAccent;
  className?: string;
}) {
  return (
    <Card variant="primary" padding="md" className={`${borderAccentClass[borderAccent]} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ds-muted">{label}</span>
        {badge}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-ds-foreground">{value}</p>
      {hint ? <div className="mt-1 text-sm text-ds-muted">{hint}</div> : null}
    </Card>
  );
}
