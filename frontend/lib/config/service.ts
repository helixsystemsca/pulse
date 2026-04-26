/**
 * Types and REST helpers for `/api/v1/config/*`.
 */

import { apiFetch } from "@/lib/api";

export type ConfigModule =
  | "global"
  | "workRequests"
  | "schedule"
  | "workers"
  | "assets"
  | "zones"
  | "automation"
  | "compliance"
  | "notifications"
  | "gamification"
  | "blueprint";

export type ModuleConfig = Record<string, unknown>;

export type ConfigOut = {
  module: ConfigModule;
  scope: string;
  config: ModuleConfig;
  defaults: ModuleConfig;
};

export type AllConfigOut = Record<ConfigModule, ModuleConfig>;

export type ZoneOverridesOut = {
  zone_id: string;
  overrides: Record<string, ModuleConfig>;
};

function qs(params: Record<string, string | null | undefined>): string {
  const p = Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join("&");
  return p ? `?${p}` : "";
}

export const configApi = {
  getAll: (companyId: string | null) =>
    apiFetch<AllConfigOut>(`/api/v1/config/all${qs({ company_id: companyId })}`),

  getModule: (module: ConfigModule, companyId: string | null, zoneId?: string | null) =>
    apiFetch<ConfigOut>(
      `/api/v1/config/${module}${qs({ company_id: companyId, zone_id: zoneId ?? null })}`,
    ),

  getDefaults: () => apiFetch<Record<ConfigModule, ModuleConfig>>("/api/v1/config/defaults"),

  patchModule: (
    module: ConfigModule,
    values: ModuleConfig,
    companyId: string | null,
    zoneId?: string | null,
  ) =>
    apiFetch<ConfigOut>(
      `/api/v1/config/${module}${qs({ company_id: companyId, zone_id: zoneId ?? null })}`,
      { method: "PATCH", body: JSON.stringify({ values }) },
    ),

  getZoneOverrides: (zoneId: string, companyId: string | null) =>
    apiFetch<ZoneOverridesOut>(
      `/api/v1/config/zones/${zoneId}/overrides${qs({ company_id: companyId })}`,
    ),

  deleteZoneOverride: (
    zoneId: string,
    module: ConfigModule,
    key: string,
    companyId: string | null,
  ) =>
    apiFetch<void>(
      `/api/v1/config/zones/${zoneId}/${module}/${key}${qs({ company_id: companyId })}`,
      { method: "DELETE" },
    ),
};
