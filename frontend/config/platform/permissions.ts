import type { PulseAuthSession } from "@/lib/pulse-session";

/**
 * Fine-grained capability strings (Phase 1 scaffold).
 * Backend should eventually issue these; until then we derive from coarse `permissions` on the session.
 */
export const PLATFORM_CAPABILITIES = [
  "workorders.view",
  "workorders.edit",
  "inspections.view",
  "inspections.edit",
  "equipment.view",
  "equipment.edit",
  "publications.create",
  "publications.export",
  "communications.assets.view",
  "communications.indesign_pipeline.view",
  "communications.advertising_mapper.view",
  "communications.campaign_planner.view",
  "procedures.view",
  "analytics.view",
  "messaging.view",
  "aquatics.scheduling.view",
  "fitness.classes.view",
] as const;

export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number];

const ALL_CAPS = new Set<string>(PLATFORM_CAPABILITIES);

/** Maps existing `/auth/me` permission keys to platform capabilities (expand over time). */
const PERMISSION_TO_CAPABILITIES: Record<string, readonly string[]> = {
  "module.maintenance.read": [
    "workorders.view",
    "workorders.edit",
    "inspections.view",
    "equipment.view",
    "procedures.view",
  ],
  "module.analytics.read": [
    "analytics.view",
    "communications.indesign_pipeline.view",
    "communications.advertising_mapper.view",
    "communications.campaign_planner.view",
  ],
  "module.jobs.read": [
    "messaging.view",
    "analytics.view",
    "communications.indesign_pipeline.view",
    "communications.advertising_mapper.view",
    "communications.campaign_planner.view",
  ],
  "module.inventory.read": ["equipment.view"],
  "module.tool_tracking.read": ["equipment.view"],
  "module.notifications.read": [
    "messaging.view",
    "communications.indesign_pipeline.view",
    "communications.advertising_mapper.view",
    "communications.campaign_planner.view",
  ],
};

function addWildcardCapabilities(out: Set<string>): void {
  PLATFORM_CAPABILITIES.forEach((c) => out.add(c));
}

/**
 * Resolve effective capability allow-list for the signed-in user.
 * When `permissions` is missing (legacy session), all platform capabilities are allowed (matches tenant nav behavior).
 */
export function resolveCapabilitiesFromSession(session: PulseAuthSession | null): string[] {
  if (!session) return PLATFORM_CAPABILITIES.slice();
  const perms = session.permissions;
  if (perms === undefined || perms === null) {
    return PLATFORM_CAPABILITIES.slice();
  }
  if (perms.includes("*")) {
    return PLATFORM_CAPABILITIES.slice();
  }
  const out = new Set<string>();
  for (const p of perms) {
    const mapped = PERMISSION_TO_CAPABILITIES[p];
    if (mapped) mapped.forEach((c) => out.add(c));
  }
  /** Company / facility tenant admins: broad operational access for Phase 1 until capability API ships. */
  if (session.role === "company_admin" || session.roles?.includes("company_admin") || session.facility_tenant_admin) {
    addWildcardCapabilities(out);
  }
  if (out.size === 0) {
    return PLATFORM_CAPABILITIES.slice();
  }
  return [...out].filter((c) => ALL_CAPS.has(c));
}

export function hasCapability(holdersCapabilities: readonly string[] | null | undefined, capability: string): boolean {
  if (!capability) return true;
  if (!holdersCapabilities || holdersCapabilities.length === 0) return false;
  if (holdersCapabilities.includes("*")) return true;
  return holdersCapabilities.includes(capability);
}

/** Convenience: session → capabilities → check. */
export function sessionHasCapability(session: PulseAuthSession | null, capability: string): boolean {
  return hasCapability(resolveCapabilitiesFromSession(session), capability);
}
