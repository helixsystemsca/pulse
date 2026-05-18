import { Hand, MousePointer2, Package, Pentagon } from "lucide-react";
import type { SpatialWorkspaceDefinition } from "@/spatial-engine/workspace/types";

export const ADVERTISING_WORKSPACE: SpatialWorkspaceDefinition = {
  id: "advertising",
  label: "Advertising",
  description: "Venue surface planner — inch geometry, constraints, and inventory.",
  status: "active",
  persistenceAdapterKey: "advertising",
  access: {
    featureKey: "advertising_mapper",
    rbacAnyOf: ["arena_advertising.view"],
  },
  sidePanels: ["left", "right"],
  layers: [
    { id: "backdrop", label: "Backdrop", zIndex: 0, defaultVisible: true, interactive: false },
    { id: "constraints", label: "Constraints", zIndex: 10, defaultVisible: true, interactive: true },
    { id: "inventory", label: "Inventory", zIndex: 20, defaultVisible: true, interactive: true },
    { id: "interaction", label: "Interaction", zIndex: 90, defaultVisible: true, interactive: true },
  ],
  tools: [
    {
      id: "select",
      label: "Select",
      group: "navigation",
      icon: MousePointer2,
      hotkeys: [{ key: "v" }],
      layerTargets: ["inventory", "constraints"],
      cursor: "default",
    },
    {
      id: "pan",
      label: "Pan",
      group: "navigation",
      icon: Hand,
      hotkeys: [{ key: "h" }],
      cursor: "grab",
    },
    {
      id: "inventory",
      label: "Inventory",
      group: "primary",
      icon: Package,
      hotkeys: [{ key: "i" }],
      layerTargets: ["inventory"],
      cursor: "grab",
    },
    {
      id: "constraint",
      label: "Constraint",
      group: "primary",
      icon: Pentagon,
      hotkeys: [{ key: "c" }],
      layerTargets: ["constraints"],
      cursor: "crosshair",
    },
  ],
};
