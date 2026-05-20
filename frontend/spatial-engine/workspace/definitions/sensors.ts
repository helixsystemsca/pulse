import { Radio } from "lucide-react";
import type { SpatialWorkspaceDefinition } from "@/spatial-engine/workspace/types";

export const SENSORS_WORKSPACE: SpatialWorkspaceDefinition = {
  id: "sensors",
  label: "Sensors",
  description: "Live sensor overlays and device placement on facility maps.",
  status: "coming_soon",
  persistenceAdapterKey: "sensors",
  access: {
    featureKey: "live_map",
    rbacAnyOf: ["live_map.view"],
  },
  sidePanels: ["left", "right"],
  layers: [
    { id: "backdrop", label: "Backdrop", zIndex: 0, defaultVisible: true, interactive: false },
    { id: "graph", label: "Sensors", zIndex: 30, defaultVisible: true, interactive: true },
    { id: "interaction", label: "Interaction", zIndex: 90, defaultVisible: true, interactive: true },
  ],
  tools: [
    {
      id: "select",
      label: "Select",
      group: "navigation",
      icon: Radio,
      disabled: true,
      disabledReason: "Coming soon",
    },
  ],
};
