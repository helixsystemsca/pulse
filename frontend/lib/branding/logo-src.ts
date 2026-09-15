/**
 * How `company.logo_url` is stored:
 * - `https://…` — public remote image
 * - `/images/…` — same-origin static file (e.g. City of Vernon seed)
 * - `/api/v1/company/logo` — authenticated upload, loaded as a blob
 */

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
