"use client";

import { useMemo } from "react";
import { formatMeasurement } from "@/modules/communications/advertising-mapper/lib/measurements";
import {
  BASE_PX_PER_INCH,
  effectivePxPerInch,
  RULER_THICKNESS_PX,
  type PlannerViewport,
} from "@/modules/communications/advertising-mapper/lib/coordinates";
import type { MeasurementUnit } from "@/modules/communications/advertising-mapper/types";

type Props = {
  wallWidthInches: number;
  wallHeightInches: number;
  viewport: PlannerViewport;
  unit: MeasurementUnit;
  stageWidth: number;
  stageHeight: number;
};

function tickStepInches(ppi: number, unit: MeasurementUnit): { major: number; minor: number } {
  const targetMajorPx = 72;
  const rawMajor = targetMajorPx / ppi;
  const candidates = unit === "ft" ? [12, 24, 36, 60, 120] : [6, 12, 24, 36, 48];
  const major = candidates.reduce((best, c) => (Math.abs(c - rawMajor) < Math.abs(best - rawMajor) ? c : best), candidates[0]!);
  return { major, minor: major / (unit === "ft" ? 4 : 2) };
}

export function AxisRulers({ wallWidthInches, wallHeightInches, viewport, unit, stageWidth, stageHeight }: Props) {
  const ppi = effectivePxPerInch(viewport);
  const { major, minor } = tickStepInches(ppi, unit);
  const originX = RULER_THICKNESS_PX + viewport.panX;
  const originY = RULER_THICKNESS_PX + viewport.panY;

  const xTicks = useMemo(() => {
    const ticks: { px: number; label?: string; major: boolean }[] = [];
    for (let inch = 0; inch <= wallWidthInches; inch += minor) {
      const px = originX + inch * BASE_PX_PER_INCH * viewport.scale;
      if (px < RULER_THICKNESS_PX - 4 || px > stageWidth) continue;
      const isMajor = inch % major === 0;
      ticks.push({
        px,
        major: isMajor,
        label: isMajor ? formatMeasurement(inch, unit, unit === "ft" ? 0 : 0) : undefined,
      });
    }
    return ticks;
  }, [wallWidthInches, viewport.scale, viewport.panX, originX, stageWidth, major, minor, unit]);

  const yTicks = useMemo(() => {
    const ticks: { px: number; label?: string; major: boolean }[] = [];
    for (let inch = 0; inch <= wallHeightInches; inch += minor) {
      const px = originY + inch * BASE_PX_PER_INCH * viewport.scale;
      if (px < RULER_THICKNESS_PX - 4 || px > stageHeight) continue;
      const isMajor = inch % major === 0;
      ticks.push({
        px,
        major: isMajor,
        label: isMajor ? formatMeasurement(inch, unit, unit === "ft" ? 0 : 0) : undefined,
      });
    }
    return ticks;
  }, [wallHeightInches, viewport.scale, viewport.panY, originY, stageHeight, major, minor, unit]);

  return (
    <>
      <div
        className="pointer-events-none absolute left-0 top-0 z-20 border-b border-r border-ds-border bg-ds-secondary/95"
        style={{ width: RULER_THICKNESS_PX, height: RULER_THICKNESS_PX }}
      />
      <div
        className="pointer-events-none absolute left-0 top-0 z-20 overflow-hidden border-b border-ds-border bg-ds-secondary/95"
        style={{ left: RULER_THICKNESS_PX, right: 0, height: RULER_THICKNESS_PX }}
      >
        {xTicks.map((t, i) => (
          <span
            key={`x-${i}`}
            className="absolute bottom-0 -translate-x-1/2 text-[9px] font-mono text-ds-muted"
            style={{ left: t.px - RULER_THICKNESS_PX }}
          >
            <span
              className="absolute bottom-0 left-1/2 w-px -translate-x-1/2 bg-ds-border"
              style={{ height: t.major ? 10 : 5 }}
            />
            {t.label ? <span className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">{t.label}</span> : null}
          </span>
        ))}
      </div>
      <div
        className="pointer-events-none absolute left-0 top-0 z-20 overflow-hidden border-r border-ds-border bg-ds-secondary/95"
        style={{ top: RULER_THICKNESS_PX, width: RULER_THICKNESS_PX, bottom: 0 }}
      >
        {yTicks.map((t, i) => (
          <span
            key={`y-${i}`}
            className="absolute left-0 -translate-y-1/2 pr-1 text-right text-[9px] font-mono text-ds-muted"
            style={{ top: t.px - RULER_THICKNESS_PX }}
          >
            <span
              className="absolute right-0 top-1/2 h-px -translate-y-1/2 bg-ds-border"
              style={{ width: t.major ? 10 : 5 }}
            />
            {t.label ? <span className="absolute right-2 top-1/2 -translate-y-1/2 whitespace-nowrap">{t.label}</span> : null}
          </span>
        ))}
      </div>
    </>
  );
}

export { RULER_THICKNESS_PX };
