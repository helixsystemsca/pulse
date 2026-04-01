/** Canonical Helix inboxes (aliases on helixsystems.ca). */

export const HELIX_INFO_EMAIL = "info@helixsystems.ca";
export const HELIX_SUPPORT_EMAIL = "support@helixsystems.ca";
export const HELIX_NOREPLY_EMAIL = "noreply@helixsystems.ca";

export function mailtoInfo(subject: string, body?: string): string {
  const q = new URLSearchParams();
  q.set("subject", subject);
  if (body?.trim()) q.set("body", body);
  return `mailto:${HELIX_INFO_EMAIL}?${q.toString()}`;
}

export function mailtoSupport(subject: string, body?: string): string {
  const q = new URLSearchParams();
  q.set("subject", subject);
  if (body?.trim()) q.set("body", body);
  return `mailto:${HELIX_SUPPORT_EMAIL}?${q.toString()}`;
}
