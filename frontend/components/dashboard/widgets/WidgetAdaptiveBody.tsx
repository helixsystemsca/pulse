"use client";

import type { CSSProperties, ReactNode } from "react";

import type { WidgetHeightTier, WidgetZoneClass } from "@/lib/dashboard/workspace-layout";
import { cn } from "@/lib/cn";

type WidgetAdaptiveBodyProps = {
  tier: WidgetHeightTier;
  zone?: WidgetZoneClass;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/**
 * Height-aware widget body shell — exposes tier/zone as data attributes and enables
 * container queries for proportional internal layouts.
 */
export function WidgetAdaptiveBody({ tier, zone, className, style, children }: WidgetAdaptiveBodyProps) {
  return (
    <div
      className={cn("dash-widget-adaptive flex h-full min-h-0 w-full min-w-0 flex-col", className)}
      data-height-tier={tier}
      data-widget-zone={zone}
      style={{ containerType: "size", ...style }}
    >
      {children}
    </div>
  );
}
