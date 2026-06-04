"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import "@/components/ui/submit-complete-check.css";

type Props = {
  /** Rendered width/height in px (tour screen uses 120px). */
  size?: number;
  className?: string;
};

/** Smaller onboarding-tour completion checkmark for inline / button success states. */
export function TourStyleSubmitCheck({ size = 24, className }: Props) {
  const gradientId = `submit-check-gradient-${useId().replace(/:/g, "")}`;

  return (
    <span
      className={cn("submit-complete-check", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg className="submit-complete-check__svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <circle
          className="submit-complete-check__pulse"
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
        />
        <circle className="submit-complete-check__circle" cx="50" cy="50" r="44" fill={`url(#${gradientId})`} />
        <path
          className="submit-complete-check__mark"
          d="M30 52 L44 66 L72 38"
          fill="none"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
