"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { DashboardAccentPreset } from "@/lib/dashboardAccentPresets";
import type { DashboardWidgetStyleOverride } from "@/lib/dashboardPageWidgetCatalog";

type Props = {
  value: DashboardWidgetStyleOverride | undefined;
  onPatch: (patch: Partial<DashboardWidgetStyleOverride>) => void;
  onReset: () => void;
  onDone: () => void;
};

const SHADOW_OPTIONS: { value: NonNullable<DashboardWidgetStyleOverride["shadowPreset"]>; label: string }[] = [
  { value: "none", label: "Default card" },
  { value: "soft", label: "Soft" },
  { value: "medium", label: "Medium" },
  { value: "deep", label: "Deep" },
];

const ACCENT_PRESET_OPTIONS: { value: DashboardAccentPreset; label: string }[] = [
  { value: "default", label: "Default surface" },
  { value: "ocean", label: "Ocean (accent)" },
  { value: "iris", label: "Iris" },
  { value: "emerald", label: "Emerald" },
  { value: "amber", label: "Amber" },
  { value: "rose", label: "Rose" },
];

export function DashboardWidgetStyleFields({ value, onPatch, onReset, onDone }: Props) {
  const borderW = value?.widgetBorderWidth ?? 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Font</p>
        <select
          className="app-field !py-2"
          value={value?.fontFamily ?? ""}
          onChange={(e) => {
            const v = e.target.value || undefined;
            onPatch({ fontFamily: v });
          }}
        >
          <option value="">Default</option>
          <option value="var(--font-app), system-ui, sans-serif">Inter (app default)</option>
          <option value="var(--font-headline), system-ui, sans-serif">Poppins</option>
          <option value="system-ui, sans-serif">System</option>
          <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">Monospace</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Color preset</p>
        <p className="text-[11px] text-ds-muted">
          Soft tint when no custom background is set. Custom background color overrides this.
        </p>
        <select
          className="app-field !py-2"
          value={value?.accentPreset ?? "default"}
          onChange={(e) => onPatch({ accentPreset: e.target.value as DashboardAccentPreset })}
          aria-label="Widget color preset"
        >
          {ACCENT_PRESET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Background</p>
          <input
            type="color"
            className="h-10 w-full cursor-pointer rounded-md border border-ds-border bg-transparent"
            value={value?.backgroundColor ?? "#ffffff"}
            onChange={(e) => onPatch({ backgroundColor: e.target.value || undefined })}
            aria-label="Widget background color"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Text color</p>
          <input
            type="color"
            className="h-10 w-full cursor-pointer rounded-md border border-ds-border bg-transparent"
            value={value?.textColor ?? "#4c5454"}
            onChange={(e) => onPatch({ textColor: e.target.value || undefined })}
            aria-label="Widget text color"
          />
        </div>
      </div>

      <div className="rounded-xl border border-ds-border bg-ds-secondary/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Stroke</p>
        <p className="mt-1 text-[11px] text-ds-muted">Adds an outline on top of the default card border.</p>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-3">
            <span className="min-w-[7rem] text-sm text-ds-foreground">Width</span>
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              className="flex-1 accent-[var(--ds-accent)]"
              value={borderW}
              onChange={(e) => onPatch({ widgetBorderWidth: Number(e.target.value) })}
              aria-valuenow={borderW}
              aria-label="Border width"
            />
            <span className="w-8 tabular-nums text-xs font-semibold text-ds-muted">{borderW}px</span>
          </label>
          {borderW > 0 ? (
            <label className="flex flex-wrap items-center gap-3">
              <span className="min-w-[7rem] text-sm text-ds-foreground">Color</span>
              <input
                type="color"
                className="h-9 w-full max-w-[10rem] cursor-pointer rounded-md border border-ds-border bg-transparent"
                value={value?.widgetBorderColor ?? "#64748b"}
                onChange={(e) => onPatch({ widgetBorderColor: e.target.value })}
                aria-label="Border color"
              />
            </label>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-ds-border bg-ds-secondary/40 p-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Drop shadow</span>
          <select
            className="app-field mt-2 !py-2"
            value={value?.shadowPreset ?? "none"}
            onChange={(e) =>
              onPatch({
                shadowPreset: e.target.value as NonNullable<DashboardWidgetStyleOverride["shadowPreset"]>,
              })
            }
          >
            {SHADOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-[11px] text-ds-muted">Layers on top of the card&apos;s base shadow. Use Default card to keep only the stock elevation.</p>
      </div>

      <div className="rounded-xl border border-ds-border bg-ds-secondary/40 p-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Glow</span>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={Boolean(value?.glowEnabled)}
            onChange={(e) => onPatch({ glowEnabled: e.target.checked })}
            aria-label="Enable glow"
          />
        </label>
        {value?.glowEnabled ? (
          <div className="mt-3 space-y-3">
            <label className="flex flex-wrap items-center gap-3">
              <span className="min-w-[7rem] text-sm text-ds-foreground">Color</span>
              <input
                type="color"
                className="h-9 w-full max-w-[10rem] cursor-pointer rounded-md border border-ds-border bg-transparent"
                value={value?.glowColor ?? "#38bdf8"}
                onChange={(e) => onPatch({ glowColor: e.target.value })}
                aria-label="Glow color"
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="min-w-[7rem] text-sm text-ds-foreground">Strength</span>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                className="flex-1 accent-[var(--ds-accent)]"
                value={value?.glowStrength ?? 48}
                onChange={(e) => onPatch({ glowStrength: Number(e.target.value) })}
                aria-label="Glow strength"
              />
              <span className="w-8 tabular-nums text-xs font-semibold text-ds-muted">{value?.glowStrength ?? 48}</span>
            </label>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-ds-border bg-ds-secondary/40 p-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Advanced theme</span>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={(value?.theme ?? "tint") !== "tint"}
            onChange={(e) => {
              const checked = e.target.checked;
              onPatch({ theme: checked ? (value?.theme ?? "solid") : "tint" });
            }}
            aria-label="Enable advanced theme"
          />
        </label>
        {(value?.theme ?? "tint") !== "tint" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["solid", "glass", "gradient"] as const).map((opt) => {
              const active = (value?.theme ?? "tint") === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-semibold capitalize transition-colors",
                    active
                      ? "border-[var(--ds-accent)] bg-[color-mix(in_srgb,var(--ds-accent)_12%,transparent)] text-ds-foreground"
                      : "border-ds-border bg-transparent text-ds-muted hover:bg-ds-interactive-hover",
                  )}
                  onClick={() => onPatch({ theme: opt })}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onReset}>
          Reset to default
        </Button>
        <Button type="button" variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
