"use client";

/**
 * Loads payment methods, invoices, and billing summary for the payments dashboard.
 */
import { useCallback, useEffect, useState } from "react";
import {
  fetchInvoices,
  fetchPaymentMethods,
  fetchPaymentSummary,
  type InvoiceListResponse,
  type PaymentMethodRow,
  type PaymentSummary,
} from "@/lib/paymentsService";

export function usePaymentMethods(companyId: string | null | undefined, enabled: boolean) {
  const [data, setData] = useState<PaymentMethodRow[] | null>(null);
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
      setData(await fetchPaymentMethods(companyId || undefined));
    } catch (e: unknown) {
      const st = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : undefined;
      setError(
        st === 403 ? "Billing is limited to company administrators." : "Could not load payment methods.",
      );
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

export function useInvoices(companyId: string | null | undefined, enabled: boolean, limit = 50) {
  const [data, setData] = useState<InvoiceListResponse | null>(null);
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
      setData(await fetchInvoices(companyId || undefined, limit, 0));
    } catch (e: unknown) {
      const st = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : undefined;
      setError(st === 403 ? "Billing is limited to company administrators." : "Could not load invoices.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, enabled, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

export function usePaymentSummary(companyId: string | null | undefined, enabled: boolean) {
  const [data, setData] = useState<PaymentSummary | null>(null);
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
      setData(await fetchPaymentSummary(companyId || undefined));
    } catch (e: unknown) {
      const st = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : undefined;
      setError(st === 403 ? "Billing is limited to company administrators." : "Could not load billing summary.");
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
