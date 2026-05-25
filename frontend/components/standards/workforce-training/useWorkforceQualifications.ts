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
};

export function useWorkforceQualificationsState(): WorkforceQualificationsState {
  const companyId = useSessionCompanyId();
  const api = isApiMode();
  const [registry, setRegistry] = useState<CanonicalCertificationDef[]>(() => readCompanyCertificationRegistry());
  const [rows, setRows] = useState<EmployeeCertificationRecord[]>([]);
  const [workers, setWorkers] = useState<WorkerDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  const expiring = useMemo(() => expiringCertifications(rows, 60), [rows]);
  const expired = useMemo(() => expiredCertifications(rows), [rows]);
  const missingProof = useMemo(() => missingProofCertifications(rows), [rows]);
  const pendingVerification = useMemo(() => pendingVerificationCertifications(rows), [rows]);
  const byWorker = useMemo(() => groupCertificationsByWorker(rows), [rows]);
  const coverage = useMemo(() => registryCoverageStats(registry, rows), [registry, rows]);

  const compliancePct = useMemo(() => {
    if (rows.length === 0) return 100;
    const ok = rows.filter((r) => r.competencyState === "qualified" && r.verificationStatus === "verified").length;
    return Math.round((ok / rows.length) * 100);
  }, [rows]);

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
    rows,
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
  };
}
