"use client";

import { TankIndicator } from "@/components/monitoring/TankIndicator";
import { WidgetAdaptiveBody } from "@/components/dashboard/widgets/WidgetAdaptiveBody";
import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import { co2TankVariant } from "@/lib/dashboard/widget-layout-modes";
import { co2Tanks } from "@/lib/monitoringMockData";
import { cn } from "@/lib/cn";

const CO2_LEVEL_MAX = 1000;

const TIER_TANK_HEIGHT: Record<string, string> = {
  compact: "min(5.5rem, 100%)",
  medium: "min(6.75rem, 100%)",
  expanded: "min(8.5rem, 100%)",
  tall: "min(10.5rem, 100%)",
};

export function Co2MonitoringOpsWidget({ layoutContext }: { layoutContext?: DashboardWidgetRenderContext }) {
  const tier = layoutContext?.heightTier ?? "compact";
  const zone = layoutContext?.zone ?? "edge";
  const tankVariant = co2TankVariant(tier);
  const compact = tankVariant === "compact";
  const tankHeight = TIER_TANK_HEIGHT[tier] ?? TIER_TANK_HEIGHT.compact;

  return (
    <WidgetAdaptiveBody tier={tier} zone={zone}>
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 items-end justify-center gap-2 px-0.5 sm:gap-3">
        {co2Tanks.map((t) => (
          <div
            key={t.id}
            className={cn("flex min-h-0 flex-1 flex-col items-center justify-end", compact && "max-w-[5.5rem]")}
            style={{ height: "100%" }}
          >
            <TankIndicator
              label={t.name}
              value={t.level}
              max={CO2_LEVEL_MAX}
              compact={compact}
              fillHeight={!compact}
              tankHeight={compact ? tankHeight : undefined}
            />
          </div>
        ))}
      </div>
    </WidgetAdaptiveBody>
  );
}
