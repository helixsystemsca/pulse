/** Standard venue signage presets — dimensions stored in inches (4′ = 48″). */
export type StandardAdSizePresetId = "4x4" | "4x8";

export type AdSizePreset = {
  id: StandardAdSizePresetId;
  label: string;
  widthInches: number;
  heightInches: number;
};

export const AD_SIZE_PRESETS: Record<StandardAdSizePresetId, AdSizePreset> = {
  "4x4": { id: "4x4", label: "4′ × 4′", widthInches: 48, heightInches: 48 },
  "4x8": { id: "4x8", label: "4′ × 8′", widthInches: 48, heightInches: 96 },
};

export const DEFAULT_AD_SIZE_PRESET: StandardAdSizePresetId = "4x4";

export function presetFromInches(width: number, height: number): StandardAdSizePresetId | "custom" {
  for (const p of Object.values(AD_SIZE_PRESETS)) {
    if (Math.abs(width - p.widthInches) < 2 && Math.abs(height - p.heightInches) < 2) return p.id;
    if (Math.abs(width - p.heightInches) < 2 && Math.abs(height - p.widthInches) < 2) return p.id;
  }
  return "custom";
}

export function presetLabel(preset: StandardAdSizePresetId | "custom" | undefined): string {
  if (!preset || preset === "custom") return "Custom";
  return AD_SIZE_PRESETS[preset].label;
}
