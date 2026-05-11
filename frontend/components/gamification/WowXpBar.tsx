"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { cn } from "@/lib/cn";

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
  enablePremiumMotion = false,
}: {
  totalXp: number;
  level: number;
  xpIntoLevel?: number;
  xpToNextLevel?: number | null;
  size?: "sm" | "md";
  showTotals?: boolean;
  /** Spring-smoothed fill, shimmer sweep, milestone pulse (respects reduced-motion). */
  enablePremiumMotion?: boolean;
}) {
  const { reduced } = useReducedEffects();
  const intoCurve = xpIntoLevel ?? Math.max(0, totalXp % 100);
  const toNext = xpToNextLevel ?? 100;
  const lit = filledSegments(intoCurve, toNext);
  const ratio = toNext > 0 ? Math.max(0, Math.min(1, intoCurve / toNext)) : 0;
  const h = size === "md" ? "h-4" : "h-3";
  const labelSz = size === "md" ? "text-xs" : "text-[11px]";
  const toNextLabel = xpToNextLevel != null ? Math.max(0, toNext - intoCurve) : Math.max(0, 100 - (totalXp % 100));

  const motionEnabled = enablePremiumMotion && !reduced;
  const progress = useMotionValue(ratio);
  const spring = useSpring(progress, motionEnabled ? { stiffness: 120, damping: 22, mass: 0.85 } : { stiffness: 400, damping: 40 });
  const prevSeg = useRef(lit);
  const [milestonePulse, setMilestonePulse] = useState(false);

  useEffect(() => {
    progress.set(ratio);
  }, [ratio, progress]);

  useEffect(() => {
    if (!motionEnabled) {
      prevSeg.current = lit;
      return;
    }
    if (lit >= XP_SEGMENTS && prevSeg.current < XP_SEGMENTS) {
      setMilestonePulse(true);
      const t = window.setTimeout(() => setMilestonePulse(false), 480);
      prevSeg.current = lit;
      return () => window.clearTimeout(t);
    }
    prevSeg.current = lit;
  }, [lit, motionEnabled]);

  const aria = useMemo(
    () =>
      motionEnabled
        ? `Level ${level}. ${intoCurve} of ${toNext} XP in this level. ${toNextLabel} XP to next level.`
        : `Level ${level}. ${intoCurve} of ${toNext} XP in this level. ${lit} of ${XP_SEGMENTS} segments filled. ${toNextLabel} XP to next level.`,
    [intoCurve, level, lit, motionEnabled, toNext, toNextLabel],
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
        className={cn(
          `relative mt-2 flex w-full gap-px rounded-md border border-amber-950/35 bg-[#0c0a06] p-px shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${h}`,
          milestonePulse && "xp-bar-milestone-pulse",
        )}
        role="progressbar"
        aria-label={aria}
        aria-valuemin={0}
        aria-valuemax={toNext}
        aria-valuenow={intoCurve}
      >
        {motionEnabled ? (
          <div className="relative isolate w-full flex-1 overflow-hidden rounded-[3px] border border-amber-950/35 bg-[#0c0a06] p-px shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="relative h-full w-full overflow-hidden rounded-[2px] bg-gradient-to-b from-[#1b160f] to-[#120e09]">
              <motion.div
                className="absolute inset-y-0 left-0 w-full origin-left rounded-[2px] bg-[linear-gradient(180deg,#fff7d6_0%,#f0d078_38%,#d4a41a_72%,#8a6a12_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(0,0,0,0.35),0_0_10px_rgba(255,214,120,0.35)]"
                style={{ scaleX: spring }}
              />
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.22]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, transparent, transparent calc(5% - 1px), rgba(0,0,0,0.42) calc(5% - 1px), rgba(0,0,0,0.42) 5%)",
                }}
                aria-hidden
              />
              <div
                key={Math.round(ratio * 1000)}
                className="pointer-events-none absolute inset-0 xp-bar-shimmer opacity-55"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-35"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))" }}
              />
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
