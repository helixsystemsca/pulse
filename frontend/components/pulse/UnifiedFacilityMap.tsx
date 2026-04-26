"use client";

import { DemoLiveMap } from "@/components/demo/DemoLiveMap";
import { LiveFacilityMap, type LiveFacilityMapProps } from "@/components/pulse/LiveFacilityMap";

export type UnifiedFacilityMapProps = LiveFacilityMapProps & {
  demoMode?: boolean;
  showControls?: boolean;
};

export function UnifiedFacilityMap({
  demoMode = false,
  showControls: _showControls,
  ...liveProps
}: UnifiedFacilityMapProps) {
  if (demoMode) {
    return <DemoLiveMap />;
  }

  return <LiveFacilityMap {...liveProps} />;
}
