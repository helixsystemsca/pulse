/**
 * How `company.logo_url` is stored:
 * - `https://…` — public remote image
 * - `/images/…` — same-origin static file (e.g. City of Vernon seed)
 * - `/api/v1/company/logo` — authenticated upload, loaded as a blob
 */

import {
  CITY_OF_VERNON_LOGO_PNG_SRC,
  CITY_OF_VERNON_LOGO_SRC,
} from "@/lib/branding/platform-defaults";

export function isHttpsLogoUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export function isPublicStaticLogoUrl(url: string): boolean {
  return url.startsWith("/images/");
}

export function isApiRelativeLogoUrl(url: string): boolean {
  return url.startsWith("/api");
}

/** URLs that can be used as an `<img src>` without an authenticated fetch. */
export function isDirectDisplayLogoUrl(url: string): boolean {
  return isHttpsLogoUrl(url) || isPublicStaticLogoUrl(url);
}

export function trimLogoUrl(url: string | null | undefined): string | null {
  const t = url?.trim();
  return t ? t : null;
}

export function isStaticSvgLogoUrl(url: string): boolean {
  return url.split("?")[0].toLowerCase().endsWith(".svg");
}

/** True when `logo_url` is the seeded City of Vernon static mark (SVG or legacy PNG). */
export function isVernonStaticLogoUrl(url: string): boolean {
  const path = url.split("?")[0];
  return path === CITY_OF_VERNON_LOGO_SRC || path === CITY_OF_VERNON_LOGO_PNG_SRC;
}

/**
 * Display URL for a tenant logo. Maps the legacy Vernon PNG onto the transparent SVG
 * so the header matches login even before bootstrap rewrites `logo_url`.
 * Custom uploads and other `/images/…` paths are unchanged.
 */
export function canonicalPublicLogoUrl(url: string): string {
  return isVernonStaticLogoUrl(url) ? CITY_OF_VERNON_LOGO_SRC : url;
}
