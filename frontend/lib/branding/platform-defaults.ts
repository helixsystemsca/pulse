/** Platform wordmark when a tenant has not uploaded a logo. */
export const PLATFORM_DEFAULT_LOGO_SRC = "/images/helix_cropped_tight.png";

/** Legacy Panorama asset — prefer {@link PLATFORM_DEFAULT_LOGO_SRC} for new surfaces. */
export const LEGACY_PANORAMA_LOGO_SRC = "/images/panoramalogo2.png";

/**
 * City of Vernon recreation-ops tenant mark (official vernon.ca artwork).
 * Transparent SVG so login and the app header blend with their backgrounds.
 * Used as tenant branding on the Vernon app host — not Helix marketing.
 */
export const CITY_OF_VERNON_LOGO_SRC = "/images/city-of-vernon-logo.svg";

/** Raster shipped in PR #10; canonicalize to {@link CITY_OF_VERNON_LOGO_SRC}. */
export const CITY_OF_VERNON_LOGO_PNG_SRC = "/images/city-of-vernon-logo.png";

/**
 * Square crop of the official Vernon mark (no wordmark) for tab favicon / apple-touch.
 * Next.js serves `app/icon.png` and `app/apple-icon.png` generated from this artwork.
 * Login and the app header keep {@link CITY_OF_VERNON_LOGO_SRC} (full lockup).
 */
export const CITY_OF_VERNON_MARK_SRC = "/images/city-of-vernon-mark.svg";

export const CITY_OF_VERNON_LOGO_ALT = "City of Vernon";
