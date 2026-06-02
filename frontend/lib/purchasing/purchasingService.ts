import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";
import type { PurchasingModuleConfig } from "@/lib/purchasing/purchasing-module-config";

function companyQs(companyId: string | null): string {
  return companyId ? `company_id=${encodeURIComponent(companyId)}` : "";
}

function withCompany(path: string, companyId: string | null): string {
  const qs = companyQs(companyId);
  const join = path.includes("?") ? "&" : "?";
  return qs ? `${path}${join}${qs}` : path;
}

export type QuickPurchaseLine = {
  id: string;
  name: string;
  quantity: number;
  unit_cost: number | null;
  category: string | null;
  add_to_inventory: boolean;
  zone_id: string | null;
  inventory_item_id: string | null;
};

export type QuickPurchase = {
  id: string;
  purchase_date: string;
  vendor_id: string | null;
  vendor_name: string | null;
  total_amount: number;
  notes: string | null;
  add_to_inventory: boolean;
  has_receipt: boolean;
  receipt_filename: string | null;
  created_by_name: string | null;
  created_at: string;
  lines: QuickPurchaseLine[];
};

export type QuickPurchaseLineInput = {
  name: string;
  quantity: number;
  unit_cost?: number | null;
  category?: string | null;
  add_to_inventory?: boolean;
  zone_id?: string | null;
};

export type VendorWithPerformance = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  preferred_vendor: boolean;
  total_purchases: number;
  last_purchase_date: string | null;
  average_purchase_value: number | null;
};

export async function fetchPurchasingSettings(companyId: string | null): Promise<PurchasingModuleConfig> {
  return apiFetch(withCompany("/api/purchasing/settings", companyId));
}

export async function fetchQuickPurchases(
  companyId: string | null,
  params?: { date_from?: string; date_to?: string; vendor_id?: string; category?: string },
): Promise<{ items: QuickPurchase[]; total: number }> {
  const sp = new URLSearchParams();
  if (params?.date_from) sp.set("date_from", params.date_from);
  if (params?.date_to) sp.set("date_to", params.date_to);
  if (params?.vendor_id) sp.set("vendor_id", params.vendor_id);
  if (params?.category) sp.set("category", params.category);
  const q = sp.toString();
  const path = q ? `/api/purchasing/quick-purchases?${q}` : "/api/purchasing/quick-purchases";
  return apiFetch(withCompany(path, companyId));
}

export async function createQuickPurchase(
  companyId: string | null,
  body: {
    purchase_date: string;
    vendor_id?: string | null;
    vendor_name?: string | null;
    total_amount: number;
    notes?: string | null;
    add_to_inventory: boolean;
    lines: QuickPurchaseLineInput[];
  },
): Promise<QuickPurchase> {
  return apiFetch(withCompany("/api/purchasing/quick-purchases", companyId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function uploadPurchaseReceipt(
  companyId: string | null,
  purchaseId: string,
  file: File,
): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const s = readSession();
  const fd = new FormData();
  fd.append("file", file);
  const url = withCompany(`/api/purchasing/quick-purchases/${encodeURIComponent(purchaseId)}/receipt`, companyId);
  const res = await fetch(`${base}${url.startsWith("/") ? url : `/${url}`}`, {
    method: "POST",
    headers: s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload failed");
  }
}

export function purchaseReceiptUrl(companyId: string | null, purchaseId: string): string {
  const base = getApiBaseUrl() || "";
  return `${base}${withCompany(`/api/purchasing/quick-purchases/${encodeURIComponent(purchaseId)}/receipt`, companyId)}`;
}

export async function fetchPurchasingVendors(companyId: string | null): Promise<VendorWithPerformance[]> {
  return apiFetch(withCompany("/api/purchasing/vendors", companyId));
}

export async function downloadExpenseExport(
  companyId: string | null,
  params: { month?: string; date_from?: string; date_to?: string },
): Promise<Blob> {
  const sp = new URLSearchParams();
  if (params.month) sp.set("month", params.month);
  if (params.date_from) sp.set("date_from", params.date_from);
  if (params.date_to) sp.set("date_to", params.date_to);
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const s = readSession();
  const url = `${base}${withCompany(`/api/purchasing/export/expenses?${sp}`, companyId)}`;
  const res = await fetch(url, {
    headers: s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}
