"use client";

import { useEffect, useMemo, useState } from "react";

export type XPBarProps = {
  currentXP: number;
  requiredXP: number;
  labelMode?: "fraction" | "remaining";
  size?: "sm" | "md";
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function XPBar({
  currentXP,
  requiredXP,
  labelMode = "fraction",
  size = "md",
  className = "",
}: XPBarProps) {
  const safeRequired = Math.max(1, requiredXP || 0);
  const pct = useMemo(() => clamp((currentXP / safeRequired) * 100, 0, 100), [currentXP, safeRequired]);

  // Trigger a smooth "animate on load" fill.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  const barH = size === "sm" ? "h-2" : "h-2.5";
  const textSz = size === "sm" ? "text-[11px]" : "text-xs";
  const remaining = Math.max(0, safeRequired - currentXP);

  return (
    <div className={className}>
      <div className={`w-full overflow-hidden rounded-full bg-ds-secondary ${barH}`} role="progressbar" aria-valuemin={0} aria-valuemax={safeRequired} aria-valuenow={currentXP}>
        <div
          className={`h-full rounded-full bg-[#4C6085] shadow-[0_0_0_1px_rgba(76,96,133,0.18)] transition-[width] duration-[800ms] ease-out`}
          style={{ width: `${mounted ? pct : 0}%` }}
        />
      </div>
      <div className={`mt-1 flex items-center justify-between ${textSz} font-semibold text-ds-muted`}>
        {labelMode === "remaining" ? (
          <span className="tabular-nums">
            <span className="text-ds-foreground/80">{remaining}</span> XP to next level
          </span>
        ) : (
          <span className="tabular-nums">
            <span className="text-ds-foreground/80">{currentXP}</span> / {safeRequired} XP
          </span>
        )}
      </div>
    </div>
  );
}

