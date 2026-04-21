"use client";

import { useMemo } from "react";

function clamp01(v: number) {
  if (Number.isNaN(v) || !Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export function WowXpBar({
  totalXp,
  level,
  size = "sm",
  showTotals = false,
}: {
  totalXp: number;
  level: number;
  size?: "sm" | "md";
  showTotals?: boolean;
}) {
  const into = Math.max(0, totalXp % 100);
  const pct = clamp01(into / 100) * 100;
  const h = size === "md" ? "h-4" : "h-3";
  const labelSz = size === "md" ? "text-xs" : "text-[11px]";

  const aria = useMemo(() => `Level ${level}. ${into} of 100 XP.`, [into, level]);

  return (
    <div className="rounded-xl border border-ds-border bg-ds-primary/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-full border border-ds-border bg-ds-secondary text-sm font-extrabold text-ds-foreground">
            {level}
          </div>
          <div className="min-w-0">
            <p className={`${labelSz} font-semibold uppercase tracking-wider text-ds-muted`}>Experience</p>
            {showTotals ? (
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-ds-foreground">
                {into}/100 <span className="text-ds-muted">({totalXp} total)</span>
              </p>
            ) : (
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-ds-muted">{into}/100</p>
            )}
          </div>
        </div>
        <span className="text-xs font-semibold text-ds-muted">Lv {level}</span>
      </div>

      <div
        className={`mt-2 w-full overflow-hidden rounded-full border border-ds-border bg-[#0b1220]/65 ${h}`}
        role="progressbar"
        aria-label={aria}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={into}
      >
        <div
          className="relative h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, rgba(58, 214, 237, 0.95) 0%, rgba(54, 241, 205, 0.92) 55%, rgba(241, 255, 253, 0.85) 100%)",
          }}
        >
          {/* subtle WoW-like gloss */}
          <div
            className="absolute inset-x-0 top-0 h-1/2 opacity-40"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0))" }}
          />
          {/* inner edge shadow */}
          <div
            className="absolute inset-0 opacity-30"
            style={{ boxShadow: "inset 0 0 10px rgba(0,0,0,0.55)" }}
          />
        </div>
      </div>
    </div>
  );
}

