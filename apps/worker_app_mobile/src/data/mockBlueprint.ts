import type { BlueprintMarker } from "@/types/models";

export const MOCK_MARKERS: BlueprintMarker[] = [
  {
    id: "m1",
    label: "AHU-12",
    topPct: 22,
    leftPct: 28,
    equipmentName: "Air handler AHU-12",
    activeTaskTitles: ["Filter change overdue", "Vibration follow-up"],
  },
  {
    id: "m2",
    label: "CH-03",
    topPct: 55,
    leftPct: 62,
    equipmentName: "Chiller CH-03",
    activeTaskTitles: ["Weekly log review"],
  },
  {
    id: "m3",
    label: "FP-1",
    topPct: 72,
    leftPct: 35,
    equipmentName: "Fire panel FP-1",
    activeTaskTitles: [],
  },
];
