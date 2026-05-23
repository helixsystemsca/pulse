import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";
import { createEmptyWallPlan } from "@/modules/communications/advertising-mapper/lib/create-wall-plan";

/** Default arena viewports — no demo inventory (user adds ads via snip / placement). */
const DEFAULT_VIEWPORTS: { id: string; name: string }[] = [
  { id: "left", name: "Left" },
  { id: "center", name: "Center" },
  { id: "right", name: "Right" },
  { id: "scoreboard", name: "Scoreboard" },
  { id: "led", name: "LED" },
];

export function getDefaultAdvertisingWallScaffolds(): FacilityWallPlan[] {
  return DEFAULT_VIEWPORTS.map(({ id, name }) => createEmptyWallPlan({ id, name }));
}

/** @deprecated Use `getDefaultAdvertisingWallScaffolds` — kept for imports that expect empty clones. */
export const MOCK_WALL_PLANS: FacilityWallPlan[] = getDefaultAdvertisingWallScaffolds();

export function cloneWallPlans(): FacilityWallPlan[] {
  return JSON.parse(JSON.stringify(MOCK_WALL_PLANS)) as FacilityWallPlan[];
}
