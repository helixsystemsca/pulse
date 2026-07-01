"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import {
  normalizeDevelopmentDetail,
  type EmployeeProfile,
} from "@/lib/team-management/employee-profile/types";
import type { WorkerDevelopmentDetail, WorkerDevelopmentPatch } from "@/lib/team-management/development-types";
import { fetchWorkerDevelopmentDetail, patchWorkerDevelopment } from "@/lib/workerDevelopmentService";
import { fetchWorkerDetail, type WorkerDetail } from "@/lib/workersService";
import { fetchWorkerTraining, type WorkerTrainingApiResponse } from "@/lib/trainingApi";

export function useEmployeeProfile(userId: string | null, options?: { onUpdated?: () => void }) {
  const onUpdated = options?.onUpdated;
  const { session } = usePulseAuth();
  const companyId = session?.company_id ?? null;
  const [development, setDevelopment] = useState<WorkerDevelopmentDetail | null>(null);
  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [training, setTraining] = useState<WorkerTrainingApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [dev, w, t] = await Promise.all([
        fetchWorkerDevelopmentDetail(id).then(normalizeDevelopmentDetail),
        fetchWorkerDetail(companyId, id).catch(() => null),
        fetchWorkerTraining(id).catch(() => null),
      ]);
      setDevelopment(dev);
      setWorker(w);
      setTraining(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load employee profile");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!userId) {
      setDevelopment(null);
      setWorker(null);
      setTraining(null);
      return;
    }
    void load(userId);
  }, [userId, load]);

  const profile = useMemo((): EmployeeProfile | null => {
    if (!userId || !development) return null;
    return { userId, development, worker, training };
  }, [userId, development, worker, training]);

  const save = useCallback(
    async (patch: WorkerDevelopmentPatch) => {
      if (!userId) return { planOverwriteRequired: false as const };
      setSaving(true);
      setError(null);
      try {
        const res = await patchWorkerDevelopment(userId, patch);
        setDevelopment(normalizeDevelopmentDetail(res.detail));
        onUpdated?.();
        return {
          planOverwriteRequired: res.plan_overwrite_required,
          message: res.message,
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [userId, onUpdated],
  );

  return {
    profile,
    development,
    worker,
    training,
    loading,
    saving,
    error,
    reload: () => (userId ? load(userId) : Promise.resolve()),
    save,
    setDevelopment,
  };
}
