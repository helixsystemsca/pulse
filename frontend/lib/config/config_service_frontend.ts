/**
 * frontend/lib/config/service.ts
 * ════════════════════════════════════════════════════════════════════════════
 * Frontend config service. Single source of truth for all config reads/writes.
 *
 * This works alongside the existing ModuleSettingsProvider during the migration
 * period. New code should use useConfig() instead of useModuleSettings().
 * Old module settings continue to work unchanged.
 */

import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  module:   ConfigModule;
  scope:    string;
  config:   ModuleConfig;
  defaults: ModuleConfig;
};

export type AllConfigOut = Record<ConfigModule, ModuleConfig>;

export type ZoneOverridesOut = {
  zone_id:   string;
  overrides: Record<string, ModuleConfig>;
};

// ── API calls ─────────────────────────────────────────────────────────────────

function qs(params: Record<string, string | null | undefined>): string {
  const p = Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join("&");
  return p ? `?${p}` : "";
}

export const configApi = {
  /** Full config dump for all modules */
  getAll: (companyId: string | null) =>
    apiFetch<AllConfigOut>(`/api/v1/config/all${qs({ company_id: companyId })}`),

  /** Single module config */
  getModule: (module: ConfigModule, companyId: string | null, zoneId?: string | null) =>
    apiFetch<ConfigOut>(
      `/api/v1/config/${module}${qs({ company_id: companyId, zone_id: zoneId ?? null })}`
    ),

  /** Platform defaults — no auth */
  getDefaults: () =>
    apiFetch<Record<ConfigModule, ModuleConfig>>("/api/v1/config/defaults"),

  /** Update company-level config for a module */
  patchModule: (
    module: ConfigModule,
    values: ModuleConfig,
    companyId: string | null,
    zoneId?: string | null,
  ) =>
    apiFetch<ConfigOut>(
      `/api/v1/config/${module}${qs({ company_id: companyId, zone_id: zoneId ?? null })}`,
      { method: "PATCH", body: JSON.stringify({ values }) }
    ),

  /** All zone overrides for a zone */
  getZoneOverrides: (zoneId: string, companyId: string | null) =>
    apiFetch<ZoneOverridesOut>(
      `/api/v1/config/zones/${zoneId}/overrides${qs({ company_id: companyId })}`
    ),

  /** Remove a zone override — falls back to company setting or default */
  deleteZoneOverride: (
    zoneId: string, module: ConfigModule, key: string, companyId: string | null
  ) =>
    apiFetch<void>(
      `/api/v1/config/zones/${zoneId}/${module}/${key}${qs({ company_id: companyId })}`,
      { method: "DELETE" }
    ),
};


/**
 * frontend/lib/config/useConfig.ts
 * ════════════════════════════════════════════════════════════════════════════
 * React hook for reading and writing config in components.
 *
 * Usage:
 *   const { config, loading, patch } = useConfig("automation");
 *   const delay = config?.escalation_delay_seconds ?? 120;
 *   await patch({ escalation_delay_seconds: 60 });
 *
 * With zone override:
 *   const { config } = useConfig("automation", { zoneId: zone.id });
 */

// NOTE: This file exports both the service (above) and the hook below.
// In your repo, split these into separate files:
//   frontend/lib/config/service.ts  (the configApi object above)
//   frontend/lib/config/useConfig.ts (the hook below)

import { useCallback, useEffect, useState } from "react";
import { readSession } from "@/lib/pulse-session";
import { sessionHasAnyRole } from "@/lib/pulse-roles";

type UseConfigOptions = {
  zoneId?: string | null;
  /** Override company ID (system admin only) */
  companyId?: string | null;
};

type UseConfigReturn<T extends ModuleConfig> = {
  config:   T | null;
  defaults: T | null;
  loading:  boolean;
  error:    string | null;
  canEdit:  boolean;
  /** Patch config values. Returns true on success. */
  patch:    (values: Partial<T>) => Promise<boolean>;
  /** Reload from server */
  refresh:  () => Promise<void>;
};

export function useConfig<T extends ModuleConfig = ModuleConfig>(
  module: ConfigModule,
  options: UseConfigOptions = {},
): UseConfigReturn<T> {
  const [config,   setConfig]   = useState<T | null>(null);
  const [defaults, setDefaults] = useState<T | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const session    = readSession();
  const companyId  = options.companyId ?? session?.company_id ?? null;
  const canEdit    = Boolean(
    session && (
      sessionHasAnyRole(session, "company_admin", "system_admin") ||
      session.is_system_admin
    )
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await configApi.getModule(module, companyId, options.zoneId);
      setConfig(out.config as T);
      setDefaults(out.defaults as T);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load config");
    } finally {
      setLoading(false);
    }
  }, [module, companyId, options.zoneId]);

  useEffect(() => { void load(); }, [load]);

  const patch = useCallback(async (values: Partial<T>): Promise<boolean> => {
    if (!canEdit) return false;
    try {
      const out = await configApi.patchModule(
        module, values as ModuleConfig, companyId, options.zoneId
      );
      setConfig(out.config as T);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save config");
      return false;
    }
  }, [canEdit, module, companyId, options.zoneId]);

  return { config, defaults, loading, error, canEdit, patch, refresh: load };
}


/**
 * frontend/lib/config/useAllConfig.ts
 * ════════════════════════════════════════════════════════════════════════════
 * Load all module configs in one call — for the Settings page.
 */
export function useAllConfig(companyId?: string | null) {
  const session   = readSession();
  const cid       = companyId ?? session?.company_id ?? null;
  const [config,  setConfig]  = useState<AllConfigOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const canEdit = Boolean(
    session && (
      sessionHasAnyRole(session, "company_admin", "system_admin") ||
      session.is_system_admin
    )
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await configApi.getAll(cid);
      setConfig(all);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load config");
    } finally {
      setLoading(false);
    }
  }, [cid]);

  useEffect(() => { void load(); }, [load]);

  const patch = useCallback(async (
    module: ConfigModule,
    values: ModuleConfig,
    zoneId?: string | null,
  ): Promise<boolean> => {
    if (!canEdit) return false;
    try {
      const out = await configApi.patchModule(module, values, cid, zoneId);
      setConfig(prev => prev ? { ...prev, [module]: out.config } : null);
      return true;
    } catch {
      return false;
    }
  }, [canEdit, cid]);

  return { config, loading, error, canEdit, patch, refresh: load };
}
