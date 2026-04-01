"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchComplianceList,
  fetchComplianceSummary,
  type ComplianceListParams,
  type ComplianceListResponse,
  type ComplianceSummary,
} from "@/lib/complianceService";

export function useComplianceSummary(companyId: string | null | undefined, enabled: boolean) {
  const [data, setData] = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const s = await fetchComplianceSummary(companyId || undefined);
      setData(s);
    } catch (e: unknown) {
      const st = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : undefined;
      setError(st === 403 ? "You need manager or company admin access to view compliance." : "Could not load compliance summary.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

export function useComplianceList(enabled: boolean, params: ComplianceListParams) {
  const [data, setData] = useState<ComplianceListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    companyId,
    status,
    userId,
    toolId,
    category,
    q,
    dateFrom,
    dateTo,
    sort,
    dir,
    limit,
    offset,
  } = params;

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetchComplianceList({
        companyId,
        status,
        userId,
        toolId,
        category,
        q,
        dateFrom,
        dateTo,
        sort,
        dir,
        limit,
        offset,
      });
      setData(r);
    } catch (e: unknown) {
      const st = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : undefined;
      setError(st === 403 ? "You need manager or company admin access to view compliance." : "Could not load compliance records.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    enabled,
    companyId,
    status,
    userId,
    toolId,
    category,
    q,
    dateFrom,
    dateTo,
    sort,
    dir,
    limit,
    offset,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
