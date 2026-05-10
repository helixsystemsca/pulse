"use client";

/**
 * Segmented toggle — uses design-system surfaces so light/dark stay consistent (no gray-100 / white track in dark mode).
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="ds-card-secondary ds-card-static flex rounded-lg p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
              active
                ? "bg-[var(--pulse-segment-active-bg)] text-[var(--pulse-segment-active-fg)] shadow-sm"
                : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
