import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
import { cn } from "@/lib/cn";

function donutSegments({
  completed,
  expiring,
  missing,
}: {
  completed: number;
  expiring: number;
  missing: number;
}): Array<{ key: string; value: number; className: string }> {
  return [
    { key: "completed", value: completed, className: "stroke-[var(--ds-success)]" },
    { key: "expiring", value: expiring, className: "stroke-[var(--ds-warning)]" },
    { key: "missing", value: missing, className: "stroke-[var(--ds-danger)]" },
  ].filter((s) => s.value > 0);
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.max(0, Math.min(100, Math.round(n)))}%`;
}

export function TrainingComplianceWidget({
  training,
  mode = "md",
}: {
  training: DashboardViewModel["training"];
  mode?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  const compact = mode === "xs" || mode === "sm";
  const radius = compact ? 30 : 34;
  const stroke = compact ? 8 : 9;
  const size = radius * 2 + stroke * 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * radius;

  const total = Math.max(0, training.totalSlots);
  const completed = Math.max(0, training.completed);
  const expiring = Math.max(0, training.expiringSoon);
  const missing = Math.max(0, training.missing);

  const segments = donutSegments({ completed, expiring, missing });
  let offset = 0;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", compact ? "gap-3" : "gap-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ds-foreground">Training compliance</p>
          <p className="mt-1 text-xs text-ds-muted">
            Mandatory programs · {total.toLocaleString()} slots
          </p>
        </div>
        <ButtonLink
          href="/standards/training"
          variant="secondary"
          className={cn(compact ? "px-3 py-2 text-xs" : "px-3.5 py-2 text-xs")}
        >
          Open training →
        </ButtonLink>
      </div>

      <div className={cn("flex min-h-0 items-center justify-between gap-4", compact ? "flex-col" : "flex-row")}>
        <div className="relative shrink-0">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="block"
            aria-label={`Overall compliance ${fmtPct(training.overallCompliancePercent)}`}
            role="img"
          >
            <g transform={`rotate(-90 ${cx} ${cy})`}>
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke="color-mix(in srgb, var(--ds-text-primary) 10%, transparent)"
                strokeWidth={stroke}
              />
              {segments.map((s) => {
                const frac = total > 0 ? s.value / total : 0;
                const len = Math.max(0, Math.min(c, c * frac));
                const dash = `${len} ${Math.max(0, c - len)}`;
                const node = (
                  <circle
                    key={s.key}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    className={s.className}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={dash}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return node;
              })}
            </g>
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className={cn("font-headline font-extrabold tabular-nums text-ds-foreground", compact ? "text-xl" : "text-2xl")}>
                {fmtPct(training.overallCompliancePercent)}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Overall</p>
            </div>
          </div>
        </div>

        <dl className={cn("w-full min-w-0 space-y-2", compact ? "max-w-sm" : "max-w-xs")}>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-ds-border bg-ds-secondary/35 px-3 py-2">
            <dt className="flex items-center gap-2 text-xs font-semibold text-ds-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-ds-success" aria-hidden />
              Completed
            </dt>
            <dd className="text-sm font-bold tabular-nums text-ds-foreground">{completed.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-ds-border bg-ds-secondary/35 px-3 py-2">
            <dt className="flex items-center gap-2 text-xs font-semibold text-ds-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-ds-warning" aria-hidden />
              Expiring
            </dt>
            <dd className="text-sm font-bold tabular-nums text-ds-foreground">{expiring.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-ds-border bg-ds-secondary/35 px-3 py-2">
            <dt className="flex items-center gap-2 text-xs font-semibold text-ds-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-ds-danger" aria-hidden />
              Missing
            </dt>
            <dd className="text-sm font-bold tabular-nums text-ds-foreground">{missing.toLocaleString()}</dd>
          </div>
          <p className="text-[11px] text-ds-muted">
            <Link href="/standards/training" className="ds-link">
              Review assignments
            </Link>{" "}
            to resolve missing and expiring items.
          </p>
        </dl>
      </div>
    </div>
  );
}

