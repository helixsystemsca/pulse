import { apiFetch } from "@/lib/api";
import type { FinanceDashboard } from "@/lib/finance/leaves";

export async function fetchFinanceDashboard(): Promise<FinanceDashboard> {
  return apiFetch<FinanceDashboard>("/api/v1/finance/dashboard");
}

export async function fetchFinance(path: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/v1/finance/${path}`);
}

export async function listFinance(entity: string): Promise<{ items: Record<string, unknown>[] }> {
  return apiFetch<{ items: Record<string, unknown>[] }>(`/api/v1/finance/${entity}`);
}

export async function createFinance(entity: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/v1/finance/${entity}`, { method: "POST", json: body });
}

export async function patchFinance(
  entity: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/v1/finance/${entity}/${id}`, { method: "PATCH", json: body });
}

export async function askBudgetAssistant(query: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/api/v1/finance/assistant/ask", { method: "POST", json: { query } });
}

export async function generateJustification(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/api/v1/finance/justifications/generate", { method: "POST", json: body });
}

export function financeReportsHref(): string {
  return "/api/v1/finance/reports.csv";
}

export function formatMoney(n: number | string | null | undefined): string {
  const v = Number(n || 0);
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);
}

export function formatMoneyExact(n: number | string | null | undefined): string {
  const v = Number(n || 0);
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(v);
}
