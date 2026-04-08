/** Standard Pulse form controls — token surfaces and focus ring */

export const dsInputClass =
  "w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2.5 text-sm text-ds-foreground shadow-sm outline-none placeholder:text-ds-muted focus:border-ds-border focus:ring-2 focus:ring-[var(--ds-focus-ring)]";

export const dsSelectClass = dsInputClass;

export const dsLabelClass =
  "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";

export const dsFormHintClass = "mt-0.5 text-xs text-ds-muted";

export const dsCheckboxClass =
  "h-4 w-4 shrink-0 rounded border-ds-border bg-ds-primary text-ds-success focus:ring-2 focus:ring-[var(--ds-focus-ring)]";

/** Input with standard top spacing after a label */
export const dsInputStackedClass = `mt-1.5 ${dsInputClass}`;
