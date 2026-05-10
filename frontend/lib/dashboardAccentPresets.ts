/**
 * Optional tint presets for Operations dashboard widget chrome (`WorkerDashCard`).
 * Applied via `--widget-tint` when the user has not set a custom background color.
 */

export type DashboardAccentPreset =
  | "default"
  | "ocean"
  | "iris"
  | "emerald"
  | "amber"
  | "rose";

/** CSS color for `backgroundColor` / `--widget-tint` when preset is active. */
export function accentPresetWidgetTint(preset: DashboardAccentPreset | undefined): string | undefined {
  switch (preset ?? "default") {
    case "default":
      return undefined;
    case "ocean":
      return "color-mix(in srgb, var(--ds-accent) 13%, var(--ds-surface-primary))";
    case "iris":
      return "color-mix(in srgb, rgb(129 140 248) 11%, var(--ds-surface-primary))";
    case "emerald":
      return "color-mix(in srgb, var(--ds-success) 12%, var(--ds-surface-primary))";
    case "amber":
      return "color-mix(in srgb, var(--ds-warning) 14%, var(--ds-surface-primary))";
    case "rose":
      return "color-mix(in srgb, var(--ds-danger) 11%, var(--ds-surface-primary))";
    default:
      return undefined;
  }
}
