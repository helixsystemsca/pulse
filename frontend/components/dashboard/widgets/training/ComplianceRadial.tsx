"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/cn";

import { TC_COLORS, TC_COLORS_STRICT } from "./training-compliance-visual";

export type ComplianceRadialProps = {
  overallCompliancePercent: number;
  completed: number;
  expiringSoon: number;
  missing: number;
  totalSlots: number;
  /** Larger chart in peek / wide tiles */
  size?: "sm" | "md" | "lg";
  /**
   * `overall` — three segments (completed / expiring / missing), center = compliance including expiring-soon.
   * `strict_mandatory` — two segments (fully complete vs not), center = % of routines-tier slots marked completed only.
   */
  mode?: "overall" | "strict_mandatory";
};

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.max(0, Math.min(100, Math.round(n)))}%`;
}

type Segment = { key: string; value: number; gradId: string };

export function ComplianceRadial({
  overallCompliancePercent,
  completed,
  expiringSoon,
  missing,
  totalSlots,
  size = "md",
  mode = "overall",
}: ComplianceRadialProps) {
  const uid = useId().replace(/:/g, "");
  const gComplete = `tc-c-${uid}`;
  const gExp = `tc-e-${uid}`;
  const gMiss = `tc-m-${uid}`;
  const gStrictDone = `tc-sd-${uid}`;
  const gStrictRest = `tc-sr-${uid}`;

  const radius = size === "sm" ? 38 : size === "lg" ? 54 : 46;
  const stroke = size === "sm" ? 6 : size === "lg" ? 7.5 : 6.5;
  const dimension = radius * 2 + stroke * 2 + 8;
  const cx = dimension / 2;
  const cy = dimension / 2;
  const c = 2 * Math.PI * radius;

  const total = Math.max(0, totalSlots);
  const segCompleted = Math.max(0, completed);
  const segExpiring = Math.max(0, expiringSoon);
  const segMissing = Math.max(0, missing);
  const countedMandatory = segCompleted + segExpiring + segMissing;

  const strictPercent =
    countedMandatory <= 0 ? 0 : Math.round((segCompleted / countedMandatory) * 100);

  const segments: Segment[] =
    mode === "strict_mandatory"
      ? [
          { key: "strict_done", value: segCompleted, gradId: gStrictDone },
          { key: "strict_rest", value: segExpiring + segMissing, gradId: gStrictRest },
        ].filter((s) => s.value > 0)
      : [
          { key: "completed", value: segCompleted, gradId: gComplete },
          { key: "expiring", value: segExpiring, gradId: gExp },
          { key: "missing", value: segMissing, gradId: gMiss },
        ].filter((s) => s.value > 0);

  /** Arc denominator: full matrix uses total slot grid; strict chart uses counted routines-tier slots only. */
  const arcTotal = mode === "strict_mandatory" ? Math.max(0, countedMandatory) : total;

  /** Tiny angular gaps between segments for a crisp segmented donut */
  const gapCount = Math.max(0, segments.length - 1);
  const gapLen = gapCount > 0 ? Math.min(c * 0.02, 8) : 0;
  const usable = Math.max(0, c - gapCount * gapLen);

  let offset = 0;

  const pctLabel = fmtPct(mode === "strict_mandatory" ? strictPercent : overallCompliancePercent);
  /** Inner radius of the donut hole (stroke centered on `radius`). Keeps labels inside the ring. */
  const innerRadiusPx = radius - stroke / 2;
  const labelMaxPx = Math.max(48, Math.floor(innerRadiusPx * 2 * 0.92));

  const titleSize = size === "sm" ? "text-[7px] tracking-[0.12em]" : size === "lg" ? "text-[11px]" : "text-[10px]";
  const pctSize =
    size === "sm" ? "text-xl leading-none" : size === "lg" ? "text-4xl leading-none" : "text-3xl leading-none";
  const completionGlow =
    mode === "overall"
      ? overallCompliancePercent >= 80 && segCompleted > 0 && total > 0
      : strictPercent >= 80 && segCompleted > 0 && countedMandatory > 0;

  return (
    <motion.div
      className={cn(
        "relative mx-auto shrink-0 rounded-full",
        mode === "overall"
          ? completionGlow && "drop-shadow-[0_0_22px_rgba(34,199,169,0.42)]"
          : completionGlow && "drop-shadow-[0_0_22px_rgba(99,102,241,0.45)]",
      )}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
        className="block overflow-visible"
        aria-label={
          mode === "strict_mandatory"
            ? `Routines fully complete ${pctLabel}`
            : `Overall compliance ${pctLabel}`
        }
        role="img"
      >
        <defs>
          <linearGradient id={gComplete} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={TC_COLORS.completed.from} />
            <stop offset="100%" stopColor={TC_COLORS.completed.to} />
          </linearGradient>
          <linearGradient id={gExp} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={TC_COLORS.expiring.from} />
            <stop offset="100%" stopColor={TC_COLORS.expiring.to} />
          </linearGradient>
          <linearGradient id={gMiss} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={TC_COLORS.missing.from} />
            <stop offset="100%" stopColor={TC_COLORS.missing.to} />
          </linearGradient>
          <linearGradient id={gStrictDone} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={TC_COLORS_STRICT.complete.from} />
            <stop offset="100%" stopColor={TC_COLORS_STRICT.complete.to} />
          </linearGradient>
          <linearGradient id={gStrictRest} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={TC_COLORS_STRICT.remainder.from} />
            <stop offset="100%" stopColor={TC_COLORS_STRICT.remainder.to} />
          </linearGradient>
        </defs>

        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            className="stroke-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] dark:stroke-white/10"
            strokeWidth={stroke}
          />
          {segments.map((s, i) => {
            const frac = arcTotal > 0 ? s.value / arcTotal : 0;
            const rawLen = usable * frac;
            const len = Math.max(0, Math.min(usable, rawLen));
            const dash = `${len} ${Math.max(0, c - len)}`;
            const node = (
              <circle
                key={s.key}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={`url(#${s.gradId})`}
                strokeWidth={stroke}
                strokeLinecap="butt"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                className="drop-shadow-[0_1px_10px_rgba(15,23,42,0.06)] dark:drop-shadow-[0_1px_14px_rgba(0,0,0,0.35)]"
              />
            );
            offset += len + (i < segments.length - 1 ? gapLen : 0);
            return node;
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <ShieldCheck
          className={cn(
            "absolute text-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] dark:text-white/[0.07]",
            size === "lg" ? "h-14 w-14" : size === "sm" ? "h-7 w-7" : "h-12 w-12",
          )}
          aria-hidden
          strokeWidth={1}
        />
        <div
          className="relative px-0.5 text-center leading-none"
          style={{ maxWidth: labelMaxPx }}
        >
          <motion.p
            key={pctLabel}
            initial={{ opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className={cn("font-headline font-extrabold tabular-nums tracking-tight text-ds-foreground", pctSize)}
          >
            {pctLabel}
          </motion.p>
          {size === "sm" ? (
            <div
              className={cn(
                "mx-auto mt-0.5 flex flex-col gap-0 font-semibold uppercase text-ds-muted",
                titleSize,
              )}
            >
              {mode === "strict_mandatory" ? (
                <>
                  <span className="leading-[1.05]">Routines</span>
                  <span className="leading-[1.05]">Complete</span>
                </>
              ) : (
                <>
                  <span className="leading-[1.05]">Overall</span>
                  <span className="leading-[1.05]">Compliance</span>
                </>
              )}
            </div>
          ) : (
            <p className={cn("mt-1 max-w-[9.5rem] text-center font-semibold uppercase leading-snug tracking-[0.14em] text-ds-muted", titleSize)}>
              {mode === "strict_mandatory" ? "Routines complete" : "Overall compliance"}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
