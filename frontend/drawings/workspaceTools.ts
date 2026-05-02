import type { PrimaryMode } from "./mapBuilderTypes";

/** Propeller-style rail tool (UI); maps to `PrimaryMode` + trace where applicable. */
export type WorkspaceTool = "select" | "asset" | "connect" | "zone" | "door" | "annotate" | "trace";

export const PRIMARY_TO_TOOL: Record<PrimaryMode, Exclude<WorkspaceTool, "door" | "trace">> = {
  select: "select",
  add_asset: "asset",
  connect: "connect",
  add_zone: "zone",
  annotate: "annotate",
};

export function toolToPrimaryMode(
  tool: WorkspaceTool,
): PrimaryMode | null {
  switch (tool) {
    case "select":
      return "select";
    case "asset":
      return "add_asset";
    case "connect":
      return "connect";
    case "zone":
      return "add_zone";
    case "annotate":
      return "annotate";
    case "door":
    case "trace":
      return null;
    default: {
      const _x: never = tool;
      return _x;
    }
  }
}
