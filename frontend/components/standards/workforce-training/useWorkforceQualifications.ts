"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { readSession } from "@/lib/pulse-session";
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

export function useWorkforceQualifications() {
  const session = readSession();
  const api = isApiMode();
  const [registry, setRegistry] = useState<CanonicalCertificationDef[]>(() => readCompanyCertificationRegistry());
  const [rows, setRows] = useState<EmployeeCertificationRecord[]>([]);
  const [workers, setWorkers] = useState<WorkerDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const reg = readCompanyCertificationRegistry();
    setRegistry(reg);
    if (!api) {
      setRows([]);
      setWorkers([]);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchWorkerList(session?.company_id ?? null, { include_inactive: false });
      const active = (list.items ?? []).filter((w) => w.is_active);
      const details = await Promise.all(
        active.slice(0, 120).map((w) => fetchWorkerDetail(session?.company_id ?? null, w.id)),
      );
      setWorkers(details);
      setRows(employeeCertificationsFromWorkerDetails(details, reg));
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [api, session]);

  useEffect(() => {
    void load();
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
