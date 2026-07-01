"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import type { TeamEmployee } from "@/lib/team-management/types";
import type { WorkerDevelopmentSummary } from "@/lib/team-management/development-types";
import { fetchWorkerDevelopmentList } from "@/lib/workerDevelopmentService";
import { fetchWorkerList, type WorkerRow } from "@/lib/workersService";

export type UseTeamEmployeesResult = {
  employees: TeamEmployee[];
  roster: WorkerRow[];
  developmentByUserId: Map<string, WorkerDevelopmentSummary>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  lastUpdatedAt: string | null;
};

/** Single source of truth — merges roster list with development summaries. */
export function useTeamEmployees(options?: { includeInactive?: boolean }): UseTeamEmployeesResult {
  const includeInactive = options?.includeInactive ?? false;
  const { session } = usePulseAuth();
  const companyId = session?.company_id ?? null;
  const [roster, setRoster] = useState<WorkerRow[]>([]);
  const [development, setDevelopment] = useState<WorkerDevelopmentSummary[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rosterRes, devRes] = await Promise.all([
        fetchWorkerList(companyId, { include_inactive: includeInactive }),
        fetchWorkerDevelopmentList({ include_inactive: includeInactive }),
      ]);
      setRoster(rosterRes.items);
      setDevelopment(devRes.items);
      setLastUpdatedAt(devRes.last_updated_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load team roster");
    } finally {
      setLoading(false);
    }
  }, [includeInactive, companyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const developmentByUserId = useMemo(() => {
    const map = new Map<string, WorkerDevelopmentSummary>();
    for (const row of development) {
      map.set(row.user_id, row);
    }
    return map;
  }, [development]);

  const employees = useMemo((): TeamEmployee[] => {
    return roster
      .filter((w) => includeInactive || w.is_active)
      .map((worker) => ({
        ...worker,
        development: developmentByUserId.get(worker.id),
      }));
  }, [roster, developmentByUserId, includeInactive]);

  return {
    employees,
    roster,
    developmentByUserId,
    loading,
    error,
    reload,
    lastUpdatedAt,
  };
}
