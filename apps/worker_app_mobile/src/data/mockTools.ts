import type { AssignedTool } from "@/types/models";

export const MOCK_TOOLS: AssignedTool[] = [
  { id: "tl1", name: "Thermal camera FLIR C5", assetTag: "AT-88421", status: "in_use" },
  { id: "tl2", name: "Torque wrench 3/8\"", assetTag: "AT-77102", status: "available" },
  { id: "tl3", name: "Multimeter Fluke 117", assetTag: "AT-66011", status: "available" },
  { id: "tl4", name: "Confined space gas monitor", assetTag: "AT-90244", status: "missing" },
];
