"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/cn";

import { TC_COLORS } from "./training-compliance-visual";

export type ComplianceRadialProps = {
  overallCompliancePercent: number;
  completed: number;
  expiringSoon: number;
  missing: number;
  totalSlots: number;
  /** Larger chart in peek / wide tiles */
  size?: "sm" | "md" | "lg";
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
}: ComplianceRadialProps) {
  const uid = useId().replace(/:/g, "");
  const gComplete = `tc-c-${uid}`;
  const gExp = `tc-e-${uid}`;
  const gMiss = `tc-m-${uid}`;

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

  const segments: Segment[] = [
    { key: "completed", value: segCompleted, gradId: gComplete },
    { key: "expiring", value: segExpiring, gradId: gExp },
    { key: "missing", value: segMissing, gradId: gMiss },
  ].filter((s) => s.value > 0);

  /** Tiny angular gaps between segments for a crisp segmented donut */
  const gapCount = Math.max(0, segments.length - 1);
  const gapLen = gapCount > 0 ? Math.min(c * 0.02, 8) : 0;
  const usable = Math.max(0, c - gapCount * gapLen);

  let offset = 0;

  const pctLabel = fmtPct(overallCompliancePercent);
  const titleSize = size === "sm" ? "text-[9px]" : size === "lg" ? "text-[11px]" : "text-[10px]";
  const pctSize = size === "sm" ? "text-2xl" : size === "lg" ? "text-4xl" : "text-3xl";
  const completionGlow = overallCompliancePercent >= 80 && segCompleted > 0 && total > 0;

  return (
    <motion.div
      className={cn(
        "relative mx-auto shrink-0 rounded-full",
        completionGlow && "drop-shadow-[0_0_22px_rgba(34,199,169,0.42)]",
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
        aria-label={`Overall compliance ${pctLabel}`}
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
            const frac = total > 0 ? s.value / total : 0;
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
            size === "lg" ? "h-14 w-14" : size === "sm" ? "h-10 w-10" : "h-12 w-12",
          )}
          aria-hidden
          strokeWidth={1}
        />
        <div className="relative text-center">
          <motion.p
            key={pctLabel}
            initial={{ opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className={cn("font-headline font-extrabold tabular-nums tracking-tight text-ds-foreground", pctSize)}
          >
            {pctLabel}
          </motion.p>
          <p
            className={cn(
              "mt-1 font-semibold uppercase tracking-[0.16em] text-ds-muted",
              titleSize,
            )}
          >
            Overall compliance
          </p>
        </div>
      </div>
    </motion.div>
  );
}
