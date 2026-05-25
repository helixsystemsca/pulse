/**
 * Organization theme tokens — local preview + CSS variable application.
 * Schema: `theme.brand` (identity) and `theme.semantic` (KPI / status) stay separate.
 */
import type { CompanySummary } from "@/lib/pulse-session";
import {
  DEFAULT_ORGANIZATION_THEME,
  normalizeOrganizationTheme,
  type OrganizationTheme,
  type ThemeBrandColorKey,
  type ThemeSemanticColorKey,
} from "@/lib/theme/theme-schema";

export type {
  OrganizationTheme,
  ThemeBrandColors,
  ThemeSemanticColors,
  ThemeBrandColorKey,
  ThemeSemanticColorKey,
} from "@/lib/theme/theme-schema";

export {
  DEFAULT_ORGANIZATION_THEME,
  normalizeOrganizationTheme,
  THEME_BRAND_TOKEN_META,
  THEME_SEMANTIC_TOKEN_META,
} from "@/lib/theme/theme-schema";

/** @deprecated Use `OrganizationTheme` */
export type OrganizationBrandColors = OrganizationTheme;

/** @deprecated Use `DEFAULT_ORGANIZATION_THEME` */
export const DEFAULT_ORGANIZATION_BRAND_COLORS = DEFAULT_ORGANIZATION_THEME;

/** @deprecated Use `normalizeOrganizationTheme` */
export const normalizeOrganizationBrandColors = normalizeOrganizationTheme;

const STORAGE_PREFIX = "pulse-org-theme-v2";

export function themeStorageKey(companyId: string): string {
  return `${STORAGE_PREFIX}:${companyId}`;
}

export function readStoredOrganizationTheme(companyId: string | null | undefined): OrganizationTheme | null {
  if (typeof window === "undefined" || !companyId) return null;
  try {
    const raw = localStorage.getItem(themeStorageKey(companyId));
    if (!raw) return readLegacyStoredTheme(companyId);
    return normalizeOrganizationTheme(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** v1 storage key migration */
function readLegacyStoredTheme(companyId: string): OrganizationTheme | null {
  try {
    const legacy = localStorage.getItem(`pulse-org-brand-colors:${companyId}`);
    if (!legacy) return null;
    return normalizeOrganizationTheme(JSON.parse(legacy));
  } catch {
    return null;
  }
}

export function writeStoredOrganizationTheme(companyId: string, theme: OrganizationTheme): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeOrganizationTheme(theme);
  localStorage.setItem(themeStorageKey(companyId), JSON.stringify(normalized));
}

/** @deprecated Use `writeStoredOrganizationTheme` */
export function writeStoredOrganizationBrandColors(companyId: string, colors: OrganizationTheme): void {
  writeStoredOrganizationTheme(companyId, colors);
}

/** @deprecated Use `readStoredOrganizationTheme` */
export function readStoredOrganizationBrandColors(companyId: string | null | undefined): OrganizationTheme | null {
  return readStoredOrganizationTheme(companyId);
}

export function resolveOrganizationTheme(company: CompanySummary | null | undefined): OrganizationTheme {
  const fromApi = company?.brand_colors;
  if (fromApi) return normalizeOrganizationTheme(fromApi);
  const stored = company?.id ? readStoredOrganizationTheme(company.id) : null;
  if (stored) return stored;
  return normalizeOrganizationTheme(DEFAULT_ORGANIZATION_THEME);
}

/** @deprecated Use `resolveOrganizationTheme` */
export const resolveOrganizationBrandColors = resolveOrganizationTheme;

function mix(hex: string, pct: number, transparent = true): string {
  return `color-mix(in srgb, ${hex} ${pct}%, ${transparent ? "transparent" : "#ffffff"})`;
}

/** Maps brand + semantic tokens into `--ds-*` runtime variables. */
export function applyOrganizationTheme(theme: OrganizationTheme): void {
  if (typeof document === "undefined") return;
  const t = normalizeOrganizationTheme(theme);
  const { brand, semantic } = t;
  const root = document.documentElement;

  root.style.setProperty("--ds-brand-primary", brand.primary);
  root.style.setProperty("--ds-brand-secondary", brand.secondary);
  root.style.setProperty("--ds-brand-accent", brand.accent);
  root.style.setProperty("--ds-brand-hover", brand.hover);
  root.style.setProperty("--ds-brand-surface", brand.surface);
  root.style.setProperty("--ds-brand-success", semantic.success);
  root.style.setProperty("--ds-brand-warning", semantic.warning);
  root.style.setProperty("--ds-brand-critical", semantic.critical);
  /** Legacy alias kept for existing CSS references */
  root.style.setProperty("--ds-brand-danger", semantic.critical);

  root.style.setProperty("--ds-accent", brand.primary);
  root.style.setProperty("--ds-accent-foreground", "#ffffff");
  root.style.setProperty("--ds-success", semantic.success);
  root.style.setProperty("--ds-warning", semantic.warning);
  root.style.setProperty("--ds-danger", semantic.critical);

  root.style.setProperty("--ds-surface-primary", brand.surface);
  root.style.setProperty(
    "--ds-surface-secondary",
    mix(brand.surface, 92, false),
  );
  root.style.setProperty(
    "--ds-surface-elevated",
    mix(brand.surface, 48, false),
  );
  root.style.setProperty("--ds-bg", mix(brand.surface, 22, false));

  root.style.setProperty("--ds-interactive-hover", mix(brand.hover, 16));
  root.style.setProperty("--ds-interactive-hover-strong", mix(brand.hover, 26));
  root.style.setProperty("--ds-interactive-active", mix(brand.primary, 22));
  root.style.setProperty("--ds-chrome-interactive-hover", mix(brand.hover, 28));
  root.style.setProperty("--ds-chrome-interactive-active", mix(brand.accent, 34));

  root.dataset.orgThemeApplied = "true";
}

/** @deprecated Use `applyOrganizationTheme` */
export const applyOrganizationBrandColors = applyOrganizationTheme;

const BRAND_CSS_KEYS = ["primary", "secondary", "accent", "hover", "surface"] as const;
const SEMANTIC_CSS_KEYS = ["success", "warning", "critical", "danger"] as const;

export function clearOrganizationThemeOverrides(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of BRAND_CSS_KEYS) {
    root.style.removeProperty(`--ds-brand-${key}`);
  }
  for (const key of SEMANTIC_CSS_KEYS) {
    root.style.removeProperty(`--ds-brand-${key}`);
  }
  root.style.removeProperty("--ds-accent");
  root.style.removeProperty("--ds-success");
  root.style.removeProperty("--ds-warning");
  root.style.removeProperty("--ds-danger");
  root.style.removeProperty("--ds-surface-primary");
  root.style.removeProperty("--ds-surface-secondary");
  root.style.removeProperty("--ds-surface-elevated");
  root.style.removeProperty("--ds-bg");
  root.style.removeProperty("--ds-interactive-hover");
  root.style.removeProperty("--ds-interactive-hover-strong");
  root.style.removeProperty("--ds-interactive-active");
  root.style.removeProperty("--ds-chrome-interactive-hover");
  root.style.removeProperty("--ds-chrome-interactive-active");
  delete root.dataset.orgThemeApplied;
}

/** @deprecated Use `clearOrganizationThemeOverrides` */
export const clearOrganizationBrandColorOverrides = clearOrganizationThemeOverrides;

export const PULSE_ORG_THEME_CHANGE_EVENT = "pulse-org-theme-change";

export function dispatchOrganizationThemeChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PULSE_ORG_THEME_CHANGE_EVENT));
}
