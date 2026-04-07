/**
 * While a system admin previews a tenant via impersonation in a modal, tenant API calls
 * use this token; `/api/system/*` continues to use the stored admin session from `readSession`.
 */

let overlayAccessToken: string | null = null;

export function setImpersonationOverlayAccessToken(token: string | null): void {
  overlayAccessToken = token;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pulse-impersonation-overlay"));
  }
}

export function getImpersonationOverlayAccessToken(): string | null {
  return overlayAccessToken;
}
