/**
 * Organization-level brand colors (5 configurable slots).
 * Scaffold for Organization & Branding — persisted locally until API fields exist.
 */
import type { CompanySummary } from "@/lib/pulse-session"; // type-only — no runtime cycle

export type OrganizationBrandColors = {
  /** Primary chrome: buttons, nav active, links (`--ds-accent`). */
  primary: string;
  /** Secondary chrome: headers, muted chrome (`--ds-text-primary` baseline). */
  secondary: string;
  /** Highlight / secondary accent (charts, pills). */
  accent: string;
  /** Completed / compliant / OK (`--ds-success`). */
  success: string;
  /** Caution / expiring (`--ds-warning`). */
  warning: string;
  /** Critical / missing / alert (`--ds-danger`). */
  danger: string;
};

export const ORGANIZATION_BRAND_COLOR_KEYS = [
  "primary",
  "secondary",
  "accent",
  "success",
  "warning",
  "danger",
] as const satisfies readonly (keyof OrganizationBrandColors)[];

export const ORGANIZATION_BRAND_LABELS: Record<keyof OrganizationBrandColors, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  success: "Success",
  warning: "Warning",
  danger: "Danger",
};

/** Product defaults — match `globals.css` :root palette. */
export const DEFAULT_ORGANIZATION_BRAND_COLORS: OrganizationBrandColors = {
  primary: "#0ea5e9",
  secondary: "#4c5454",
  accent: "#38bdf8",
  success: "#1ea896",
  warning: "#c9932e",
  danger: "#f6511d",
};

const STORAGE_PREFIX = "pulse-org-brand-colors";

export function brandColorsStorageKey(companyId: string): string {
  return `${STORAGE_PREFIX}:${companyId}`;
}

export function readStoredOrganizationBrandColors(companyId: string | null | undefined): OrganizationBrandColors | null {
  if (typeof window === "undefined" || !companyId) return null;
  try {
    const raw = localStorage.getItem(brandColorsStorageKey(companyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OrganizationBrandColors>;
    return normalizeOrganizationBrandColors(parsed);
  } catch {
    return null;
  }
}

export function writeStoredOrganizationBrandColors(
  companyId: string,
  colors: OrganizationBrandColors,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(brandColorsStorageKey(companyId), JSON.stringify(colors));
}

export function normalizeOrganizationBrandColors(
  input: Partial<OrganizationBrandColors> | null | undefined,
): OrganizationBrandColors {
  const d = DEFAULT_ORGANIZATION_BRAND_COLORS;
  if (!input) return { ...d };
  return {
    primary: input.primary?.trim() || d.primary,
    secondary: input.secondary?.trim() || d.secondary,
    accent: input.accent?.trim() || d.accent,
    success: input.success?.trim() || d.success,
    warning: input.warning?.trim() || d.warning,
    danger: input.danger?.trim() || d.danger,
  };
}

/** Resolve colors: API field (future) → local preview → defaults. */
export function resolveOrganizationBrandColors(
  company: CompanySummary | null | undefined,
): OrganizationBrandColors {
  const fromApi = company?.brand_colors;
  if (fromApi) return normalizeOrganizationBrandColors(fromApi);
  const stored = company?.id ? readStoredOrganizationBrandColors(company.id) : null;
  if (stored) return stored;
  return { ...DEFAULT_ORGANIZATION_BRAND_COLORS };
}

/** Apply brand slots to the document — maps into existing `--ds-*` semantic tokens. */
export function applyOrganizationBrandColors(colors: OrganizationBrandColors): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--ds-brand-primary", colors.primary);
  root.style.setProperty("--ds-brand-secondary", colors.secondary);
  root.style.setProperty("--ds-brand-accent", colors.accent);
  root.style.setProperty("--ds-brand-success", colors.success);
  root.style.setProperty("--ds-brand-warning", colors.warning);
  root.style.setProperty("--ds-brand-danger", colors.danger);
  root.style.setProperty("--ds-accent", colors.primary);
  root.style.setProperty("--ds-success", colors.success);
  root.style.setProperty("--ds-warning", colors.warning);
  root.style.setProperty("--ds-danger", colors.danger);
  root.dataset.orgThemeApplied = "true";
}

export function clearOrganizationBrandColorOverrides(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of ORGANIZATION_BRAND_COLOR_KEYS) {
    root.style.removeProperty(`--ds-brand-${key}`);
  }
  root.style.removeProperty("--ds-accent");
  root.style.removeProperty("--ds-success");
  root.style.removeProperty("--ds-warning");
  root.style.removeProperty("--ds-danger");
  delete root.dataset.orgThemeApplied;
}

export const PULSE_ORG_THEME_CHANGE_EVENT = "pulse-org-theme-change";

export function dispatchOrganizationThemeChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PULSE_ORG_THEME_CHANGE_EVENT));
}
