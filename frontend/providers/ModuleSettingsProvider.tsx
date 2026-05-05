"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isApiMode } from "@/lib/api";
import {
  DEFAULT_ORG_MODULE_SETTINGS,
  mergeOrgModuleSettings,
  type ModuleId,
  type OrgModuleSettingsRoot,
} from "@/lib/moduleSettings/defaults";
import { fetchOrgModuleSettings, patchOrgModuleSettings } from "@/lib/moduleSettings/service";
import { readModuleSettingsCache, writeModuleSettingsCache } from "@/lib/moduleSettings/storage";
import { canAccessCompanyConfiguration } from "@/lib/pulse-roles";
import { canAccessPulseTenantApis, isPulseAuthTeardown, readSession } from "@/lib/pulse-session";
import { usePulseAuth } from "@/hooks/usePulseAuth";

type Ctx = {
  settings: OrgModuleSettingsRoot;
  loading: boolean;
  error: string | null;
  /** Last company id used for API/cache (tenant jwt or explicit picker for system admins). */
  loadedCompanyId: string | null;
  refresh: () => Promise<void>;
  /** For system-admin UIs with a company dropdown: load settings for that tenant. */
  loadForCompany: (companyId: string | null) => Promise<void>;
  savePartial: (patch: Partial<OrgModuleSettingsRoot>) => Promise<boolean>;
  canConfigure: boolean;
};

const ModuleSettingsContext = createContext<Ctx | null>(null);

export function ModuleSettingsProvider({ children }: { children: ReactNode }) {
  const { authed, session } = usePulseAuth();
  const [settings, setSettings] = useState<OrgModuleSettingsRoot>(() => mergeOrgModuleSettings(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedCompanyId, setLoadedCompanyId] = useState<string | null>(null);

  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const canConfigure = canAccessCompanyConfiguration(session);

  const loadForCompany = useCallback(
    async (companyId: string | null) => {
      const s = readSession();
      if (!s?.access_token || !isApiMode()) {
        setLoading(false);
        return;
      }
      const sys = Boolean(s.is_system_admin || s.role === "system_admin");
      const tenantCid = s.company_id ?? null;
      const apiCompanyQs = sys ? companyId : null;
      const cacheKey = sys ? companyId : tenantCid;

      if (!sys && !canAccessPulseTenantApis(s)) {
        setLoading(false);
        return;
      }
      if (sys && !companyId) {
        setSettings(mergeOrgModuleSettings(readModuleSettingsCache(null)));
        setLoadedCompanyId(null);
        setLoading(false);
        return;
      }

      const cached = readModuleSettingsCache(cacheKey);
      if (cached && Object.keys(cached).length > 0) {
        setSettings(mergeOrgModuleSettings(cached));
      }

      try {
        setError(null);
        const data = await fetchOrgModuleSettings(apiCompanyQs);
        setSettings(data);
        if (cacheKey) writeModuleSettingsCache(cacheKey, data);
        setLoadedCompanyId(cacheKey ?? null);
      } catch (e) {
        if (!isPulseAuthTeardown()) {
          setError(e instanceof Error ? e.message : "Could not load organization settings");
        }
        if (cached) setSettings(mergeOrgModuleSettings(cached));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const s = readSession();
    if (Boolean(s?.is_system_admin || s?.role === "system_admin")) {
      await loadForCompany(loadedCompanyId);
      return;
    }
    await loadForCompany(s?.company_id ?? null);
  }, [loadForCompany, loadedCompanyId]);

  useEffect(() => {
    void (async () => {
      if (!authed) {
        setLoading(false);
        setError(null);
        return;
      }
      const s = readSession();
      if (isSystemAdmin) {
        setLoading(false);
        return;
      }
      await loadForCompany(s?.company_id ?? null);
    })();
  }, [authed, isSystemAdmin, loadForCompany, session?.sub, session?.company_id]);

  const savePartial = useCallback(
    async (patch: Partial<OrgModuleSettingsRoot>): Promise<boolean> => {
      const s = readSession();
      const sys = Boolean(s?.is_system_admin || s?.role === "system_admin");
      const cacheKey = sys ? loadedCompanyId : (s?.company_id ?? null);

      const next = { ...settings } as OrgModuleSettingsRoot;
      (Object.keys(patch) as ModuleId[]).forEach((k) => {
        const p = patch[k];
        if (p) (next as Record<string, unknown>)[k] = { ...(settings[k] as object), ...(p as object) };
      });
      setSettings(next);
      if (cacheKey) writeModuleSettingsCache(cacheKey, next);

      if (!isApiMode() || !canConfigure) return true;
      try {
        const merged = await patchOrgModuleSettings(sys ? loadedCompanyId : null, patch);
        setSettings(merged);
        if (cacheKey) writeModuleSettingsCache(cacheKey, merged);
        return true;
      } catch {
        await loadForCompany(sys ? loadedCompanyId : (s?.company_id ?? null));
        return false;
      }
    },
    [canConfigure, loadedCompanyId, loadForCompany, settings],
  );

  const value = useMemo<Ctx>(
    () => ({
      settings,
      loading,
      error,
      loadedCompanyId,
      refresh,
      loadForCompany,
      savePartial,
      canConfigure,
    }),
    [settings, loading, error, loadedCompanyId, refresh, loadForCompany, savePartial, canConfigure],
  );

  return <ModuleSettingsContext.Provider value={value}>{children}</ModuleSettingsContext.Provider>;
}

export function useModuleSettingsContext(): Ctx {
  const c = useContext(ModuleSettingsContext);
  if (!c) throw new Error("useModuleSettingsContext must be used within ModuleSettingsProvider");
  return c;
}

export function useModuleSettingsOptional(): Ctx | null {
  return useContext(ModuleSettingsContext);
}

export function useModuleSettings<M extends ModuleId>(moduleId: M) {
  const ctx = useModuleSettingsOptional();
  const defaults = DEFAULT_ORG_MODULE_SETTINGS[moduleId];
  const settings = ctx?.settings[moduleId] ?? defaults;

  const update = useCallback(
    async (partial: Partial<(typeof DEFAULT_ORG_MODULE_SETTINGS)[M]>) => {
      if (!ctx?.canConfigure) return false;
      return ctx.savePartial({ [moduleId]: { ...settings, ...partial } } as Partial<OrgModuleSettingsRoot>);
    },
    [ctx, moduleId, settings],
  );

  const reset = useCallback(async () => {
    if (!ctx?.canConfigure) return false;
    const d = JSON.parse(JSON.stringify(defaults)) as (typeof DEFAULT_ORG_MODULE_SETTINGS)[M];
    return ctx.savePartial({ [moduleId]: d } as Partial<OrgModuleSettingsRoot>);
  }, [ctx, moduleId, defaults]);

  return {
    settings,
    defaults,
    loading: ctx?.loading ?? false,
    error: ctx?.error ?? null,
    canConfigure: ctx?.canConfigure ?? false,
    update,
    reset,
    refresh: ctx?.refresh ?? (async () => {}),
    loadForCompany: ctx?.loadForCompany ?? (async () => {}),
  };
}
