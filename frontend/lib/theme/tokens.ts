/**
 * Semantic design tokens — maps to CSS variables in `app/globals.css`.
 * Prefer these names in TS/TSX when referencing theme values programmatically.
 *
 * Brand identity (`brand.*`) and operational semantics (`semantic.*`) are configured
 * separately in Organization & Branding — do not use semantic colors for chrome/buttons.
 */

/** CSS custom property names (use as `var(--ds-accent)` or Tailwind `text-ds-accent`). */
export const CSS_VARS = {
  brand: {
    primary: "--ds-brand-primary",
    secondary: "--ds-brand-secondary",
    accent: "--ds-brand-accent",
    hover: "--ds-brand-hover",
    surface: "--ds-brand-surface",
  },
  semantic: {
    success: "--ds-brand-success",
    warning: "--ds-brand-warning",
    critical: "--ds-brand-critical",
    /** @deprecated Alias of critical — prefer `critical` in new code */
    danger: "--ds-brand-danger",
  },
  surface: {
    bg: "--ds-bg",
    primary: "--ds-surface-primary",
    secondary: "--ds-surface-secondary",
    elevated: "--ds-surface-elevated",
  },
  text: {
    primary: "--ds-text-primary",
    secondary: "--ds-text-secondary",
  },
  border: "--ds-border",
  accent: "--ds-accent",
  accentForeground: "--ds-accent-foreground",
  success: "--ds-success",
  warning: "--ds-warning",
  danger: "--ds-danger",
  info: "--ds-info",
  onAccent: "--ds-on-accent",
  interactive: {
    hover: "--ds-interactive-hover",
    hoverStrong: "--ds-interactive-hover-strong",
    active: "--ds-interactive-active",
  },
  shadow: {
    card: "--ds-shadow-card",
    cardHover: "--ds-shadow-card-hover",
    diffuse: "--ds-shadow-diffuse",
  },
  radius: {
    card: "--ds-radius-card",
    dashCard: "--dash-card-radius",
  },
  motion: {
    fast: "--ds-transition-fast",
    base: "--ds-transition-base",
  },
} as const;

/** Tailwind utility groups aligned to the design system (canonical class strings). */
export const TW = {
  text: {
    foreground: "text-ds-foreground",
    muted: "text-ds-muted",
    accent: "text-ds-accent",
    onAccent: "text-ds-on-accent",
  },
  bg: {
    page: "bg-ds-bg",
    primary: "bg-ds-primary",
    secondary: "bg-ds-secondary",
    elevated: "bg-ds-elevated",
  },
  border: {
    default: "border-ds-border",
  },
} as const;
