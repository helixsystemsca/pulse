"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { useSessionCompanyId } from "@/hooks/useSessionCompanyId";
import { fetchWorkerDetail, fetchWorkerList, type WorkerDetail } from "@/lib/workersService";
import {
  employeeCertificationsFromWorkerDetails,
  expiredCertifications,
  expiringCertifications,
  groupCertificationsByWorker,
  missingProofCertifications,
  pendingVerificationCertifications,
  registryCoverageStats,
  type EmployeeCertificationRecord,
} from "@/lib/standards/employee-certifications";
import {
  readCompanyCertificationRegistry,
  writeCompanyCertificationRegistry,
  type CanonicalCertificationDef,
} from "@/lib/standards/certification-registry";
import {
  applyOverridesToCertificationRows,
  cycleCompetencyOverride,
  cycleVerificationOverride,
  getEffectiveCompetency,
  getEffectiveVerification,
  readQualificationOverrides,
  setSyntheticCertOverride,
  workerRegistryOverrideKey,
  writeQualificationOverrides,
  type QualificationOverridesMap,
} from "@/lib/standards/qualification-overrides";

const WORKER_DETAIL_CAP = 120;
const WORKER_DETAIL_CONCURRENCY = 6;
const DEBUG =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_WORKFORCE_FETCH === "1";

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

export type WorkforceQualificationsState = {
  api: boolean;
  registry: CanonicalCertificationDef[];
  rows: EmployeeCertificationRecord[];
  workers: WorkerDetail[];
  loading: boolean;
  err: string | null;
  reload: () => Promise<void>;
  updateRegistry: (next: CanonicalCertificationDef[]) => void;
  expiring: EmployeeCertificationRecord[];
  expired: EmployeeCertificationRecord[];
  missingProof: EmployeeCertificationRecord[];
  pendingVerification: EmployeeCertificationRecord[];
  byWorker: ReturnType<typeof groupCertificationsByWorker>;
  coverage: ReturnType<typeof registryCoverageStats>;
  compliancePct: number;
  overrides: QualificationOverridesMap;
  cycleCompetency: (record: EmployeeCertificationRecord) => void;
  cycleVerification: (record: EmployeeCertificationRecord) => void;
  addWorkerCertification: (workerId: string, registryCode: string) => void;
  getEffectiveCompetency: (record: EmployeeCertificationRecord) => ReturnType<typeof getEffectiveCompetency>;
  getEffectiveVerification: (record: EmployeeCertificationRecord) => ReturnType<typeof getEffectiveVerification>;
};

export function useWorkforceQualificationsState(): WorkforceQualificationsState {
  const companyId = useSessionCompanyId();
  const api = isApiMode();
  const [registry, setRegistry] = useState<CanonicalCertificationDef[]>(() => readCompanyCertificationRegistry());
  const [rows, setRows] = useState<EmployeeCertificationRecord[]>([]);
  const [workers, setWorkers] = useState<WorkerDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<QualificationOverridesMap>(() =>
    readQualificationOverrides(companyId),
  );

  useEffect(() => {
    setOverrides(readQualificationOverrides(companyId));
  }, [companyId]);

  const persistOverrides = useCallback(
    (next: QualificationOverridesMap) => {
      setOverrides(next);
      writeQualificationOverrides(companyId, next);
    },
    [companyId],
  );

  const loadGenRef = useRef(0);
  const lastLoadAtRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const reg = readCompanyCertificationRegistry();
    setRegistry(reg);

    if (!api) {
      setRows([]);
      setWorkers([]);
      setLoading(false);
      setErr(null);
      return;
    }

    const now = Date.now();
    if (DEBUG && now - lastLoadAtRef.current < 500) {
      console.warn("[workforce-qualifications] load() called again within 500ms — check effect deps");
    }
    lastLoadAtRef.current = now;
    if (DEBUG) console.debug("[workforce-qualifications] load start", { companyId, gen });

    setLoading(true);
    setErr(null);
    try {
      const list = await fetchWorkerList(companyId, { include_inactive: false });
      if (gen !== loadGenRef.current) return;

      const active = (list.items ?? []).filter((w) => w.is_active).slice(0, WORKER_DETAIL_CAP);
      const details = await mapWithConcurrency(active, WORKER_DETAIL_CONCURRENCY, (w) =>
        fetchWorkerDetail(companyId, w.id),
      );
      if (gen !== loadGenRef.current) return;

      setWorkers(details);
      setRows(employeeCertificationsFromWorkerDetails(details, reg));
      if (DEBUG) console.debug("[workforce-qualifications] load done", { workers: details.length, gen });
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      setErr(parseClientApiError(e).message);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [api, companyId]);

  useEffect(() => {
    void load();
    return () => {
      loadGenRef.current += 1;
    };
  }, [load]);

  const rowsWithSynthetic = useMemo(() => {
    const existingKeys = new Set(rows.map((r) => workerRegistryOverrideKey(r.workerId, r.registryCode)));
    const extra: EmployeeCertificationRecord[] = [];
    for (const key of Object.keys(overrides)) {
      if (!key.includes("::") || existingKeys.has(key)) continue;
      const [workerId, code] = key.split("::");
      if (!workerId || !code) continue;
      const w = workers.find((x) => x.id === workerId);
      const reg = registry.find((r) => r.code === code);
      if (!w || !reg) continue;
      extra.push({
        id: key,
        workerId,
        workerName: w.full_name ?? w.email,
        department: w.department ?? null,
        registryCode: code,
        label: reg.label,
        expiryDate: null,
        competencyState: "in_progress",
        verificationStatus: "unverified",
        proofDocumentUrl: null,
        issuedAt: null,
      });
      existingKeys.add(key);
    }
    return [...rows, ...extra];
  }, [rows, overrides, workers, registry]);

  const effectiveRows = useMemo(
    () => applyOverridesToCertificationRows(rowsWithSynthetic, overrides),
    [rowsWithSynthetic, overrides],
  );

  const expiring = useMemo(() => expiringCertifications(effectiveRows, 60), [effectiveRows]);
  const expired = useMemo(() => expiredCertifications(effectiveRows), [effectiveRows]);
  const missingProof = useMemo(() => missingProofCertifications(effectiveRows), [effectiveRows]);
  const pendingVerification = useMemo(
    () => pendingVerificationCertifications(effectiveRows),
    [effectiveRows],
  );
  const byWorker = useMemo(() => groupCertificationsByWorker(effectiveRows), [effectiveRows]);
  const coverage = useMemo(() => registryCoverageStats(registry, effectiveRows), [registry, effectiveRows]);

  const compliancePct = useMemo(() => {
    if (effectiveRows.length === 0) return 100;
    const ok = effectiveRows.filter(
      (r) => r.competencyState === "qualified" && r.verificationStatus === "verified",
    ).length;
    return Math.round((ok / effectiveRows.length) * 100);
  }, [effectiveRows]);

  const cycleCompetency = useCallback(
    (record: EmployeeCertificationRecord) => {
      persistOverrides(cycleCompetencyOverride(record, overrides));
    },
    [overrides, persistOverrides],
  );

  const cycleVerification = useCallback(
    (record: EmployeeCertificationRecord) => {
      persistOverrides(cycleVerificationOverride(record, overrides));
    },
    [overrides, persistOverrides],
  );

  const addWorkerCertification = useCallback(
    (workerId: string, registryCode: string) => {
      persistOverrides(setSyntheticCertOverride(workerId, registryCode, overrides));
    },
    [overrides, persistOverrides],
  );

  const getEffectiveCompetencyCb = useCallback(
    (record: EmployeeCertificationRecord) => getEffectiveCompetency(record, overrides),
    [overrides],
  );

  const getEffectiveVerificationCb = useCallback(
    (record: EmployeeCertificationRecord) => getEffectiveVerification(record, overrides),
    [overrides],
  );

  const updateRegistry = useCallback(
    (next: CanonicalCertificationDef[]) => {
      setRegistry(next);
      writeCompanyCertificationRegistry(next);
      void load();
    },
    [load],
  );

  return {
    api,
    registry,
    rows: effectiveRows,
    workers,
    loading,
    err,
    reload: load,
    updateRegistry,
    expiring,
    expired,
    missingProof,
    pendingVerification,
    byWorker,
    coverage,
    compliancePct,
    overrides,
    cycleCompetency,
    cycleVerification,
    addWorkerCertification,
    getEffectiveCompetency: getEffectiveCompetencyCb,
    getEffectiveVerification: getEffectiveVerificationCb,
  };
}
