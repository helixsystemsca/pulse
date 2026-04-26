"use client";

import { useCallback, useEffect, useState } from "react";
import { readSession } from "@/lib/pulse-session";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import {
  configApi,
  type AllConfigOut,
  type ConfigModule,
  type ModuleConfig,
} from "./service";

type UseConfigOptions = {
  zoneId?: string | null;
  companyId?: string | null;
};

type UseConfigReturn<T extends ModuleConfig> = {
  config: T | null;
  defaults: T | null;
  loading: boolean;
  error: string | null;
  canEdit: boolean;
  patch: (values: Partial<T>) => Promise<boolean>;
  refresh: () => Promise<void>;
};

export function useConfig<T extends ModuleConfig = ModuleConfig>(
  module: ConfigModule,
  options: UseConfigOptions = {},
): UseConfigReturn<T> {
  const [config, setConfig] = useState<T | null>(null);
  const [defaults, setDefaults] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const session = readSession();
  const companyId = options.companyId ?? session?.company_id ?? null;
  const canEdit = Boolean(
    session &&
      (sessionHasAnyRole(session, "company_admin", "system_admin") || session.is_system_admin),
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

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (values: Partial<T>): Promise<boolean> => {
      if (!canEdit) return false;
      try {
        const out = await configApi.patchModule(
          module,
          values as ModuleConfig,
          companyId,
          options.zoneId,
        );
        setConfig(out.config as T);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save config");
        return false;
      }
    },
    [canEdit, module, companyId, options.zoneId],
  );

  return { config, defaults, loading, error, canEdit, patch, refresh: load };
}

export function useAllConfig(companyId?: string | null) {
  const session = readSession();
  const cid = companyId ?? session?.company_id ?? null;
  const [config, setConfig] = useState<AllConfigOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = Boolean(
    session &&
      (sessionHasAnyRole(session, "company_admin", "system_admin") || session.is_system_admin),
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

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (
      module: ConfigModule,
      values: ModuleConfig,
      zoneId?: string | null,
    ): Promise<boolean> => {
      if (!canEdit) return false;
      try {
        const out = await configApi.patchModule(module, values, cid, zoneId);
        setConfig((prev) => (prev ? { ...prev, [module]: out.config } : null));
        return true;
      } catch {
        return false;
      }
    },
    [canEdit, cid],
  );

  return { config, loading, error, canEdit, patch, refresh: load };
}
