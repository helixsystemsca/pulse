import type { PulseAuthSession } from "@/lib/pulse-session";

/**
 * Legacy fine-grained capability strings still used by a few platform hub components.
 * Authorization is **RBAC-first** (`rbac_permissions`); this map only translates flat keys → these labels.
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

/** Flat RBAC keys from `/auth/me` → legacy platform capability tokens (best-effort). */
const RBAC_TO_PLATFORM_CAPS: Record<string, readonly string[]> = {
  "work_requests.view": ["workorders.view"],
  "work_requests.edit": ["workorders.view", "workorders.edit"],
  "compliance.view": ["inspections.view"],
  "compliance.manage": ["inspections.view", "inspections.edit"],
  "inventory.view": ["equipment.view"],
  "inventory.manage": ["equipment.view"],
  "equipment.view": ["equipment.view"],
  "equipment.manage": ["equipment.view", "equipment.edit"],
  "procedures.view": ["procedures.view"],
  "team_insights.view": ["analytics.view"],
  "team_management.view": ["analytics.view"],
  "messaging.view": ["messaging.view"],
  "schedule.view": ["aquatics.scheduling.view", "fitness.classes.view"],
  "projects.view": ["analytics.view"],
  "drawings.view": ["analytics.view"],
  "zones_devices.view": ["equipment.view"],
  "arena_advertising.view": ["communications.advertising_mapper.view"],
  "social_planner.view": ["communications.campaign_planner.view"],
  "publication_pipeline.view": ["publications.create", "publications.export"],
  "xplor_indesign.view": ["communications.indesign_pipeline.view"],
  "communications_assets.view": ["communications.assets.view"],
  "workspace.view": [
    "procedures.view",
    "analytics.view",
    "messaging.view",
    "workorders.view",
    "workorders.edit",
    "inspections.view",
    "equipment.view",
    "publications.create",
    "publications.export",
    "communications.assets.view",
    "communications.indesign_pipeline.view",
    "communications.advertising_mapper.view",
    "communications.campaign_planner.view",
  ],
};

/**
 * Resolve legacy platform capability tokens from `rbac_permissions` only.
 * Empty RBAC → empty list (strict). `*` → full catalog.
 */
export function resolveCapabilitiesFromSession(session: PulseAuthSession | null): string[] {
  if (!session) return [];
  const rbac = session.rbac_permissions;
  if (!rbac?.length) return [];
  if (rbac.includes("*")) {
    return PLATFORM_CAPABILITIES.slice();
  }
  const out = new Set<string>();
  for (const k of rbac) {
    const caps = RBAC_TO_PLATFORM_CAPS[k];
    if (caps) caps.forEach((c) => out.add(c));
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
