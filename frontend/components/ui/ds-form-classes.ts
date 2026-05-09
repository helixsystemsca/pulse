/** Standard Pulse form controls — token surfaces and focus ring */

export const dsInputClass =
  "w-full rounded-lg border border-ds-border/90 bg-white px-3 py-2.5 text-sm text-ds-foreground shadow-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-ds-muted focus:border-[color-mix(in_srgb,var(--ds-accent)_42%,var(--ds-border))] focus:bg-white focus:ring-2 focus:ring-[var(--ds-focus-ring)] dark:bg-ds-secondary dark:focus:bg-ds-secondary";

export const dsSelectClass = dsInputClass;

export const dsLabelClass =
  "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";

export const dsFormHintClass = "mt-0.5 text-xs text-ds-muted";

export const dsCheckboxClass =
  "h-4 w-4 shrink-0 rounded border-ds-border bg-white text-ds-success focus:ring-2 focus:ring-[var(--ds-focus-ring)] dark:bg-ds-secondary";

/** Input with standard top spacing after a label */
export const dsInputStackedClass = `mt-1.5 ${dsInputClass}`;
