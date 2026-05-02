import type { AnnotateKind, PrimaryMode } from "./mapBuilderTypes";
import type { SystemType } from "./utils/graphHelpers";

export type BuilderSemanticMode = "fiber" | "electrical" | "irrigation" | "telemetry";

export type MapModeConfig = {
  label: string;
  defaultSystemType: SystemType;
  allowedPrimaryModes: ReadonlySet<PrimaryMode>;
  allowedAnnotateKinds: ReadonlySet<AnnotateKind>;
  graphRules: { directedEdges: boolean };
  interaction: {
    /** Connect-mode rubber band follows nearest asset center when true; raw pointer when false. */
    snapConnectPreviewToAssets: boolean;
    /** Draw-connection tool snaps segment endpoints to nearest assets within this radius (world px). */
    drawConnectionSnapRadiusWorld: number;
  };
  ui: {
    showSystemLayerToggles: boolean;
    showTraceRoute: boolean;
    showDefaultSystemPicker: boolean;
    showInfrastructureFilters: boolean;
  };
};

/** Default superset — modes narrow this via `allowedPrimaryModes`. */
export const BUILDER_ALL_PRIMARY_MODES: ReadonlySet<PrimaryMode> = new Set(["select", "add_asset", "connect", "add_zone", "annotate"]);
const ALL_PRIMARY = BUILDER_ALL_PRIMARY_MODES;
const ALL_ANNOTATE: ReadonlySet<AnnotateKind> = new Set(["symbol", "text", "sketch", "pen"]);

function infraPreset(label: string, system: SystemType): MapModeConfig {
  return {
    label,
    defaultSystemType: system,
    allowedPrimaryModes: ALL_PRIMARY,
    allowedAnnotateKinds: ALL_ANNOTATE,
    graphRules: { directedEdges: false },
    interaction: {
      snapConnectPreviewToAssets: true,
      drawConnectionSnapRadiusWorld: 52,
    },
    ui: {
      showSystemLayerToggles: true,
      showTraceRoute: true,
      showDefaultSystemPicker: true,
      showInfrastructureFilters: true,
    },
  };
}

export const MODES: Record<BuilderSemanticMode, MapModeConfig> = {
  fiber: infraPreset("Fiber Optic", "fiber"),
  electrical: infraPreset("Electrical", "electrical"),
  irrigation: infraPreset("Irrigation", "irrigation"),
  telemetry: infraPreset("Telemetry", "telemetry"),
};

export const BUILDER_MODE_STORAGE_KEY = "helix.drawings.builderSemanticMode";

export function isBuilderSemanticMode(raw: string | null | undefined): raw is BuilderSemanticMode {
  return raw != null && raw in MODES;
}
