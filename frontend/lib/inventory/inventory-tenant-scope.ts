/** Whether the tenant contract is centered on inventory (no workforce schedule module). */

import { isTenantFeatureOnContract, tenantEnabledFeatures } from "@/lib/features/tenant-features";
import type { PulseAuthSession } from "@/lib/pulse-session";

function contractIncludesSchedule(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  if (isTenantFeatureOnContract(session, "schedule")) return true;
  return tenantEnabledFeatures(session).some(
    (k) => k === "schedule" || k.startsWith("schedule_"),
  );
}

/** Inventory is on contract and schedule/workforce facilities are not. */
export function isInventoryPrimaryTenant(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  if (!isTenantFeatureOnContract(session, "inventory")) return false;
  return !contractIncludesSchedule(session);
}
