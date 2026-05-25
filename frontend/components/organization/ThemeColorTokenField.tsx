"use client";

import { dsLabelClass } from "@/components/ui/ds-form-classes";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  purpose: string;
  value: string;
  onChange: (hex: string) => void;
  className?: string;
};

export function ThemeColorTokenField({ label, purpose, value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border border-ds-border bg-ds-primary/60 p-3 shadow-[var(--ds-shadow-card)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn(dsLabelClass, "text-ds-foreground")}>{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-ds-muted">{purpose}</p>
        </div>
        <span
          className="h-9 w-9 shrink-0 rounded-md border border-ds-border shadow-inner"
          style={{ backgroundColor: value }}
          aria-hidden
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-ds-border bg-ds-primary p-0.5"
          aria-label={`${label} color picker`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-ds-border bg-ds-primary px-2 py-1.5 font-mono text-xs text-ds-foreground"
          spellCheck={false}
          aria-label={`${label} hex value`}
        />
      </div>
    </div>
  );
}
