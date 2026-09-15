import { isPulseAppHost } from "@/lib/pulse-host";
import {
  CITY_OF_VERNON_LOGO_ALT,
  CITY_OF_VERNON_LOGO_SRC,
  PLATFORM_DEFAULT_LOGO_SRC,
} from "@/lib/branding/platform-defaults";
import { canonicalPublicLogoUrl, isDirectDisplayLogoUrl, trimLogoUrl } from "@/lib/branding/logo-src";

export const VERNON_APP_HOSTNAME = "vernon.helixsystems.ca";

export type AuthBrandKind = "vernon" | "helix";

export type AuthBrand = {
  kind: AuthBrandKind;
  cinematicSrc: string;
  cinematicAlt: string;
  /** Helix wordmark as a secondary “powered by” line (Vernon tenant only). */
  showPoweredByHelix: boolean;
};

const HELIX_AUTH_BRAND: AuthBrand = {
  kind: "helix",
  cinematicSrc: PLATFORM_DEFAULT_LOGO_SRC,
  cinematicAlt: "Helix",
  showPoweredByHelix: false,
};

const VERNON_AUTH_BRAND: AuthBrand = {
  kind: "vernon",
  cinematicSrc: CITY_OF_VERNON_LOGO_SRC,
  cinematicAlt: CITY_OF_VERNON_LOGO_ALT,
  showPoweredByHelix: true,
};

function hostnameFromPulseAppUrl(): string | null {
  if (typeof process === "undefined") return null;
  const raw = process.env.NEXT_PUBLIC_PULSE_APP_URL?.trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = new URL(withScheme).hostname.toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

function normalizeHostname(hostname: string | null | undefined): string {
  return (hostname ?? "").toLowerCase().split(":")[0].trim();
}

export function isVernonAppHostname(hostname: string | null | undefined): boolean {
  const h = normalizeHostname(hostname);
  if (!h) return false;
  return h === VERNON_APP_HOSTNAME || h.endsWith(`.${VERNON_APP_HOSTNAME}`);
}

export function isLocalDevHostname(hostname: string | null | undefined): boolean {
  const h = normalizeHostname(hostname);
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
}

export function isCityOfVernonCompanyName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return false;
  return n.includes("city of vernon");
}

/**
 * Effective Pulse app host from `NEXT_PUBLIC_PULSE_APP_URL`, defaulting to Vernon
 * (same default as {@link DEFAULT_PULSE_APP_ORIGIN}).
 */
export function configuredPulseAppHostname(): string {
  return hostnameFromPulseAppUrl() ?? VERNON_APP_HOSTNAME;
}

/**
 * City of Vernon tenant branding for unauthenticated chrome (login, invite, reset).
 *
 * True when:
 * - the browser/request host is `vernon.helixsystems.ca`, or
 * - this deployment’s `NEXT_PUBLIC_PULSE_APP_URL` is Vernon and the current host is
 *   a Pulse app host (including legacy aliases) or local/dev.
 *
 * Marketing-only hosts (`www.helixsystems.ca`, etc.) stay on Helix.
 */
export function shouldUseVernonAuthBrand(hostname: string | null | undefined): boolean {
  const h = normalizeHostname(hostname);
  if (!h) return false;
  if (isVernonAppHostname(h)) return true;
  if (!isVernonAppHostname(configuredPulseAppHostname())) return false;
  if (isLocalDevHostname(h)) return true;
  return isPulseAppHost(h);
}

export function resolveAuthBrand(hostname: string | null | undefined): AuthBrand {
  return shouldUseVernonAuthBrand(hostname) ? VERNON_AUTH_BRAND : HELIX_AUTH_BRAND;
}

/**
 * Welcome / logout overlays: prefer a displayable tenant `logo_url`, then Vernon
 * host/company, then the Helix cinematic mark.
 */
export function resolveAuthModalBrand(opts: {
  hostname: string | null | undefined;
  companyName?: string | null;
  logoUrl?: string | null;
}): AuthBrand {
  const logoUrl = trimLogoUrl(opts.logoUrl);
  const displayLogo = logoUrl ? canonicalPublicLogoUrl(logoUrl) : null;
  if (displayLogo && isDirectDisplayLogoUrl(displayLogo)) {
    const vernon =
      shouldUseVernonAuthBrand(opts.hostname) || isCityOfVernonCompanyName(opts.companyName);
    return {
      kind: vernon ? "vernon" : "helix",
      cinematicSrc: displayLogo,
      cinematicAlt: (opts.companyName ?? "").trim() || (vernon ? CITY_OF_VERNON_LOGO_ALT : "Organization"),
      showPoweredByHelix: vernon,
    };
  }
  if (shouldUseVernonAuthBrand(opts.hostname) || isCityOfVernonCompanyName(opts.companyName)) {
    return VERNON_AUTH_BRAND;
  }
  return HELIX_AUTH_BRAND;
}
