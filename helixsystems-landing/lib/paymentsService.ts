/**
 * Typed API calls for `/api/payments` (mock billing). Pass `companyId` for system admins.
 */
import { apiFetch } from "@/lib/api";

export type PaymentMethodRow = {
  id: string;
  company_id: string;
  type: "card" | "bank";
  brand: string | null;
  bank_name: string | null;
  last4: string;
  expiry_month: number | null;
  expiry_year: number | null;
  rail: string | null;
  holder_name: string | null;
  is_primary: boolean;
  created_at: string;
};

export type InvoiceRow = {
  id: string;
  company_id: string;
  amount: string;
  currency: string;
  status: "paid" | "pending" | "failed";
  issued_at: string;
  paid_at: string | null;
  reference_number: string;
};

export type PaymentSummary = {
  next_billing_date: string | null;
  billing_cycle: string;
  region_label: string;
  encryption_note: string;
};

export type InvoiceListResponse = { items: InvoiceRow[]; total: number };

function qsv(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function fetchPaymentMethods(companyId?: string | null): Promise<PaymentMethodRow[]> {
  return apiFetch<PaymentMethodRow[]>(`/api/payments/methods${qsv({ company_id: companyId ?? undefined })}`);
}

export async function createPaymentMethod(
  body: {
    type: "card";
    card: { card_number: string; expiry: string; holder_name: string; is_primary?: boolean };
  } | {
    type: "bank";
    bank: { bank_name: string; account_last4: string; rail: "ach" | "wire_swift"; is_primary?: boolean };
  },
  companyId?: string | null,
): Promise<PaymentMethodRow> {
  return apiFetch<PaymentMethodRow>(`/api/payments/methods${qsv({ company_id: companyId ?? undefined })}`, {
    method: "POST",
    json: body,
  });
}

export async function deletePaymentMethod(id: string, companyId?: string | null): Promise<void> {
  await apiFetch(`/api/payments/methods/${id}${qsv({ company_id: companyId ?? undefined })}`, {
    method: "DELETE",
  });
}

export async function setPrimaryPaymentMethod(id: string, companyId?: string | null): Promise<PaymentMethodRow> {
  return apiFetch<PaymentMethodRow>(
    `/api/payments/methods/${id}/set-primary${qsv({ company_id: companyId ?? undefined })}`,
    { method: "PATCH" },
  );
}

export async function fetchInvoices(
  companyId?: string | null,
  limit = 50,
  offset = 0,
): Promise<InvoiceListResponse> {
  return apiFetch<InvoiceListResponse>(
    `/api/payments/invoices${qsv({ company_id: companyId ?? undefined, limit, offset })}`,
  );
}

export async function createInvoice(
  body: { amount: number | string; currency?: string; reference_number?: string | null },
  companyId?: string | null,
): Promise<InvoiceRow> {
  return apiFetch<InvoiceRow>(`/api/payments/invoices${qsv({ company_id: companyId ?? undefined })}`, {
    method: "POST",
    json: {
      amount: typeof body.amount === "string" ? Number(body.amount) : body.amount,
      currency: body.currency ?? "USD",
      reference_number: body.reference_number?.trim() || null,
    },
  });
}

export async function recordInvoicePayment(invoiceId: string, companyId?: string | null): Promise<InvoiceRow> {
  return apiFetch<InvoiceRow>(
    `/api/payments/invoices/${invoiceId}/record-payment${qsv({ company_id: companyId ?? undefined })}`,
    { method: "POST" },
  );
}

export async function fetchPaymentSummary(companyId?: string | null): Promise<PaymentSummary> {
  return apiFetch<PaymentSummary>(`/api/payments/summary${qsv({ company_id: companyId ?? undefined })}`);
}
