"use client";

import { useEffect, useId } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useReducedEffects } from "@/hooks/useReducedEffects";

export function RadialXpRing({
  xpInto,
  xpToNext,
  level,
  size = 120,
  className,
}: {
  xpInto: number;
  xpToNext: number;
  level: number;
  size?: number;
  className?: string;
}) {
  const { reduced } = useReducedEffects();
  const span = Math.max(1, xpToNext);
  const ratio = Math.max(0, Math.min(1, xpInto / span));
  const progress = useMotionValue(ratio);
  const spring = useSpring(progress, reduced ? { stiffness: 400, damping: 40 } : { stiffness: 90, damping: 18 });
  const stroke = 8;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;

  useEffect(() => {
    progress.set(ratio);
  }, [ratio, progress]);

  const dashOffset = useTransform(spring, (v) => c * (1 - v));
  const gid = useId().replace(/:/g, "");
  const gradId = `xp-ring-fill-${gid}`;

  return (
    <div className={`relative ${className ?? ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: dashOffset }}
        />
        {!reduced ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={stroke + 4}
            className="xp-ring-shimmer"
          />
        ) : null}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ds-muted">Level</span>
        <span className="font-headline text-2xl font-black tabular-nums text-ds-foreground">{level}</span>
        <span className="mt-0.5 text-[10px] font-semibold tabular-nums text-ds-muted">
          {xpInto}/{span}
        </span>
      </div>
    </div>
  );
}
