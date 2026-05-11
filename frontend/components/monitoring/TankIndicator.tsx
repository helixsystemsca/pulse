import { useMemo } from "react";

import { cn } from "@/lib/cn";

type TankIndicatorProps = {
  label: string;
  value: number;
  max: number;
  /** Shorter capsule and typography for dense dashboard tiles */
  compact?: boolean;
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

export function TankIndicator({ label, value, max, compact = false }: TankIndicatorProps) {
  const status = useMemo(() => getStatus(value), [value]);
  const percent = useMemo(() => {
    const m = Math.max(1, max);
    return Math.min(100, Math.max(0, (value / m) * 100));
  }, [max, value]);
  const percentLabel = useMemo(() => `${Math.round(percent)}%`, [percent]);

  return (
    <div className={cn("flex flex-col items-center", compact && "w-full min-w-0 max-w-[5.5rem]")}>
      <div
        className={cn("shrink-0 rounded bg-ds-muted/30", compact ? "mb-0.5 h-1 w-4" : "mb-1 h-2 w-6")}
        aria-hidden
      />
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full border border-ds-border bg-ds-secondary/60",
          compact
            ? "h-[5.5rem] w-9 shadow-[0_4px_12px_rgba(15,23,42,0.07)] sm:h-24 sm:w-10"
            : "h-40 w-16 shadow-[0_10px_24px_rgba(15,23,42,0.10)]",
        )}
        role="img"
        aria-label={`${label} indicator`}
      >
        {/* Glass highlight */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(120deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.10) 35%, rgba(255,255,255,0.0) 60%)",
          }}
          aria-hidden
        />
        <div
          className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${statusColors[status]}`}
          style={{ height: `${percent}%` }}
          aria-hidden
        />
        {/* Liquid sheen */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0"
          style={{
            height: `${percent}%`,
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.0) 35%, rgba(255,255,255,0.12) 70%, rgba(255,255,255,0.0) 100%)",
            mixBlendMode: "overlay",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 flex items-center justify-center px-0.5">
          <span
            className={cn(
              "rounded bg-black/30 font-bold tabular-nums text-white backdrop-blur-[2px]",
              compact ? "px-1 py-px text-[9px] sm:text-[10px]" : "rounded-md px-2 py-1 text-xs",
            )}
          >
            {percentLabel}
          </span>
        </div>
      </div>
      <p
        className={cn(
          "w-full text-center font-semibold leading-tight text-ds-foreground",
          compact ? "mt-0.5 line-clamp-2 text-[10px] leading-snug" : "mt-2 text-sm",
        )}
        title={label}
      >
        {label}
      </p>
      <p className={cn("w-full text-center text-ds-muted", compact ? "mt-0.5 text-[9px] leading-tight sm:text-[10px]" : "mt-0.5 text-xs")}>
        <span className="tabular-nums">{value}</span> / {max} • {statusLabels[status]}
      </p>
    </div>
  );
}

