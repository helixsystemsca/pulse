import { useMemo } from "react";

type TankIndicatorProps = {
  label: string;
  value: number;
  max: number;
  sublabel?: string;
};

type TankStatus = "ok" | "change_soon" | "change_now";

function getStatus(value: number): TankStatus {
  // CO₂ mock sensor ranges in Monitoring are modeled on a 0–1000 scale.
  // Keep indicator thresholds aligned with `getCo2TankStatus`.
  if (value < 300) return "change_now";
  if (value <= 350) return "change_soon";
  return "ok";
}

const statusColors: Record<TankStatus, string> = {
  ok: "bg-ds-success",
  change_soon: "bg-ds-warning",
  change_now: "bg-ds-danger",
};

const statusLabels: Record<TankStatus, string> = {
  ok: "OK",
  change_soon: "Change soon",
  change_now: "Change now",
};

export function TankIndicator({ label, value, max, sublabel }: TankIndicatorProps) {
  const status = useMemo(() => getStatus(value), [value]);
  const percent = useMemo(() => {
    const m = Math.max(1, max);
    return Math.min(100, Math.max(0, (value / m) * 100));
  }, [max, value]);
  const percentLabel = useMemo(() => `${Math.round(percent)}%`, [percent]);

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
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-md bg-black/30 px-2 py-1 text-xs font-bold tabular-nums text-white backdrop-blur-[2px]">
            {percentLabel}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold text-ds-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-ds-muted">
        <span className="tabular-nums">{value}</span> / {max} • {statusLabels[status]}
        {sublabel ? <span className="text-ds-muted/80"> · {sublabel}</span> : null}
      </p>
    </div>
  );
}

