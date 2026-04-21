"use client";

import { useMemo } from "react";

const XP_SEGMENTS = 20;

function filledSegments(into: number, toNext?: number | null): number {
  if (toNext != null && toNext > 0) {
    const ratio = Math.max(0, Math.min(1, into / toNext));
    return Math.min(XP_SEGMENTS, Math.floor(ratio * XP_SEGMENTS + 1e-9));
  }
  const v = Math.max(0, Math.min(100, Math.floor(into)));
  return Math.min(XP_SEGMENTS, Math.floor(v / 5));
}

export function WowXpBar({
  totalXp,
  level,
  xpIntoLevel,
  xpToNextLevel,
  size = "sm",
  showTotals = false,
}: {
  totalXp: number;
  level: number;
  xpIntoLevel?: number;
  xpToNextLevel?: number | null;
  size?: "sm" | "md";
  showTotals?: boolean;
}) {
  const intoCurve = xpIntoLevel ?? Math.max(0, totalXp % 100);
  const toNext = xpToNextLevel ?? 100;
  const lit = filledSegments(intoCurve, toNext);
  const h = size === "md" ? "h-4" : "h-3";
  const labelSz = size === "md" ? "text-xs" : "text-[11px]";
  const toNextLabel = xpToNextLevel != null ? Math.max(0, toNext - intoCurve) : Math.max(0, 100 - (totalXp % 100));

  const aria = useMemo(
    () =>
      `Level ${level}. ${intoCurve} of ${toNext} XP in this level. ${lit} of ${XP_SEGMENTS} segments filled. ${toNextLabel} XP to next level.`,
    [intoCurve, level, lit, toNext, toNextLabel],
  );

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
                {intoCurve} / {toNext} XP
                <span className="text-ds-muted"> · {toNextLabel} to next</span>
                <span className="text-ds-muted"> ({totalXp} total)</span>
              </p>
            ) : (
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-ds-muted">
                {intoCurve} / {toNext} XP
              </p>
            )}
          </div>
        </div>
        <span className="text-xs font-semibold text-ds-muted">Lv {level}</span>
      </div>

      <div
        className={`relative mt-2 flex w-full gap-px rounded-md border border-amber-950/35 bg-[#0c0a06] p-px shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${h}`}
        role="progressbar"
        aria-label={aria}
        aria-valuemin={0}
        aria-valuemax={toNext}
        aria-valuenow={intoCurve}
      >
        {Array.from({ length: XP_SEGMENTS }).map((_, i) => {
          const on = i < lit;
          return (
            <div key={i} className="relative min-w-0 flex-1 overflow-hidden rounded-[2px]">
              <div
                className="h-full w-full transition-[background,box-shadow] duration-[800ms] ease-out"
                style={
                  on
                    ? {
                        transitionDelay: `${Math.min(i, 12) * 18}ms`,
                        background:
                          "linear-gradient(180deg, #fff7d6 0%, #f0d078 38%, #d4a41a 72%, #8a6a12 100%)",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.35), 0 0 6px rgba(255, 214, 120, 0.35)",
                      }
                    : {
                        background: "linear-gradient(180deg, #1b160f 0%, #120e09 100%)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                      }
                }
              />
            </div>
          );
        })}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-35"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))" }}
        />
      </div>
    </div>
  );
}
