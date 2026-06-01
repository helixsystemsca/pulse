"use client";

import { Search } from "lucide-react";
import { useId, type Ref } from "react";
import { cn } from "@/lib/cn";
import { dsInputClass } from "@/components/ui/ds-form-classes";
import type { InventoryScanProduct } from "@/lib/inventory-scanner/inventoryScannerService";

const BTN_RADIUS = "rounded-xl";
const bubbleStroke = "border-2 border-[color-mix(in_srgb,var(--ds-text-primary)_28%,var(--ds-border))]";

export const scannerSearchInputClass = cn(
  dsInputClass,
  bubbleStroke,
  BTN_RADIUS,
  "h-14 w-full bg-white/70 pl-12 pr-4 text-lg text-ds-foreground backdrop-blur-sm placeholder:text-ds-muted sm:h-16 sm:pl-14 sm:text-xl",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.75),inset_0_-2px_4px_rgba(15,23,42,0.05)]",
);

const dropdownClass = cn(
  BTN_RADIUS,
  "border-2 border-[color-mix(in_srgb,var(--ds-text-primary)_28%,var(--ds-border))] bg-white/95 py-1 shadow-lg backdrop-blur-sm",
);

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onPickSuggestion: (row: InventoryScanProduct) => void;
  suggestions: InventoryScanProduct[];
  suggestOpen: boolean;
  onSuggestOpen: (open: boolean) => void;
  busy?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  label?: string;
  placeholder?: string;
  className?: string;
};

export function ScannerSearchStrip({
  value,
  onChange,
  onSubmit,
  onPickSuggestion,
  suggestions,
  suggestOpen,
  onSuggestOpen,
  busy,
  inputRef,
  label = "Find product",
  placeholder = "Scan barcode or search name, SKU…",
  className,
}: Props) {
  const inputId = useId();

  return (
    <div className={cn("w-full shrink-0 border-b border-ds-border/80 bg-ds-primary/95 px-4 py-3 backdrop-blur-sm sm:px-6", className)}>
      <label htmlFor={inputId} className="mb-2 block text-xs font-bold uppercase tracking-widest text-ds-muted sm:text-sm">
        {label}
      </label>
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ds-muted sm:left-5 sm:h-6 sm:w-6" />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={value}
          data-scanner-manual-input="true"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          disabled={busy}
          onChange={(e) => {
            onChange(e.target.value);
            onSuggestOpen(true);
          }}
          onFocus={() => onSuggestOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
            if (e.key === "Escape") onSuggestOpen(false);
          }}
          className={scannerSearchInputClass}
        />
        {suggestOpen && value.trim() && suggestions.length > 0 ? (
          <ul className={cn(dropdownClass, "absolute z-30 mt-2 max-h-64 w-full overflow-y-auto")} role="listbox">
            {suggestions.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full flex-col px-4 py-3 text-left hover:bg-ds-interactive-hover"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPickSuggestion(row)}
                >
                  <span className="text-base font-semibold text-ds-foreground sm:text-lg">{row.name}</span>
                  <span className="text-sm text-ds-muted">
                    {row.sku}
                    {row.category ? ` · ${row.category}` : ""} · {row.quantity} {row.unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
