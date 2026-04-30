import { useMemo } from "react";

type TankIndicatorProps = {
  label: string;
  value: number;
};

const MAX_VISUAL = 500;

type TankStatus = "healthy" | "warning" | "critical";

function getStatus(value: number): TankStatus {
  if (value <= 300) return "critical";
  if (value <= 400) return "warning";
  return "healthy";
}

const statusColors: Record<TankStatus, string> = {
  healthy: "bg-ds-success",
  warning: "bg-ds-warning",
  critical: "bg-ds-danger",
};

const statusLabels: Record<TankStatus, string> = {
  healthy: "Good",
  warning: "Caution",
  critical: "Low",
};

export function TankIndicator({ label, value }: TankIndicatorProps) {
  const status = useMemo(() => getStatus(value), [value]);
  const percent = useMemo(() => Math.min(100, (value / MAX_VISUAL) * 100), [value]);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-1 h-2 w-6 rounded bg-ds-muted/30" aria-hidden />
      <div
        className="relative h-40 w-16 overflow-hidden rounded-full border border-ds-border bg-ds-secondary/60"
        role="img"
        aria-label={`${label} indicator`}
      >
        <div
          className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${statusColors[status]}`}
          style={{ height: `${percent}%` }}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-sm font-semibold text-ds-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-ds-muted">
        <span className="tabular-nums">{value}</span> PSI • {statusLabels[status]}
      </p>
    </div>
  );
}

