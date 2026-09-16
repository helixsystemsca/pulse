"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export function HireProgressRing({
  percent,
  size = "md",
  label,
}: {
  percent: number;
  size?: "sm" | "md";
  label?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const value = Math.max(0, Math.min(100, Math.round(Number.isFinite(percent) ? percent : 0)));
  const radius = size === "sm" ? 18 : 28;
  const stroke = size === "sm" ? 4 : 5;
  const dim = radius * 2 + stroke * 2;
  const cx = dim / 2;
  const cy = dim / 2;
  const c = 2 * Math.PI * radius;
  const dash = (value / 100) * c;
  const title = label ?? `${value}% complete`;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} aria-hidden>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="color-mix(in srgb, var(--ds-text-primary) 10%, transparent)"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={`url(#hire-prog-${uid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <defs>
          <linearGradient id={`hire-prog-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--ds-accent)" />
            <stop offset="100%" stopColor="var(--ds-accent)" />
          </linearGradient>
        </defs>
      </svg>
      <span
        className={cn(
          "absolute tabular-nums font-bold text-ds-foreground",
          size === "sm" ? "text-[10px]" : "text-xs",
        )}
      >
        {value}%
      </span>
      <span className="sr-only">{title}</span>
    </div>
  );
}
