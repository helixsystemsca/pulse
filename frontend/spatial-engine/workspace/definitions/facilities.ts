import { Building } from "lucide-react";
import type { SpatialWorkspaceDefinition } from "@/spatial-engine/workspace/types";

export const FACILITIES_WORKSPACE: SpatialWorkspaceDefinition = {
  id: "facilities",
  label: "Facilities",
  description: "Building zones, rooms, and facility layouts.",
  status: "coming_soon",
  persistenceAdapterKey: "facilities",
  access: {
    featureKey: "zones_devices",
    rbacAnyOf: ["zones_devices.view"],
  },
  sidePanels: ["left", "right"],
  layers: [
    { id: "backdrop", label: "Backdrop", zIndex: 0, defaultVisible: true, interactive: false },
    { id: "annotations", label: "Zones", zIndex: 20, defaultVisible: true, interactive: true },
    { id: "interaction", label: "Interaction", zIndex: 90, defaultVisible: true, interactive: true },
  ],
  tools: [
    {
      id: "select",
      label: "Select",
      group: "navigation",
      icon: Building,
      disabled: true,
      disabledReason: "Coming soon",
    },
  ],
};
