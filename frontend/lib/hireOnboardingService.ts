/** Client for hire-time onboarding document packets (`/api/workers/.../hire-onboarding`). */

import { apiFetch } from "@/lib/api";
import { withCompanyQuery } from "@/lib/hire-onboarding/with-company";

export type HireDocKind = "review" | "sign";
export type HireAppliesWhen = "always" | "plant_role";
export type HireItemStatus = "pending" | "completed";
export type HirePacketStatus = "open" | "completed";

export type HireTemplateItem = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  kind: HireDocKind;
  body_text: string | null;
  applies_when: HireAppliesWhen;
  is_required: boolean;
};

export type HireTemplate = {
  id: string;
  company_id: string;
  name: string;
  items: HireTemplateItem[];
  updated_at: string;
};

export type HirePacketProgress = {
  required_total: number;
  required_completed: number;
  percent: number;
  status: HirePacketStatus;
};

export type HirePacketItem = {
  id: string;
  sort_order: number;
  item_key: string;
  title: string;
  description: string | null;
  kind: HireDocKind;
  body_text: string | null;
  is_required: boolean;
  status: HireItemStatus;
  completed_at: string | null;
  completed_by_user_id: string | null;
  signature_name: string | null;
  signed_ack: boolean;
};

export type HirePacket = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  status: HirePacketStatus;
  progress: HirePacketProgress;
  items: HirePacketItem[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type HireIncompleteHire = {
  packet_id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  required_total: number;
  required_completed: number;
  percent: number;
  incomplete_titles: string[];
};

export type HireIncompleteSummary = {
  open_hires: number;
  incomplete_required_items: number;
  hires: HireIncompleteHire[];
};

export type HireTemplateItemWrite = {
  id?: string;
  key?: string;
  title: string;
  description?: string | null;
  kind: HireDocKind;
  body_text?: string | null;
  applies_when: HireAppliesWhen;
  is_required: boolean;
};

function path(companyId: string | null, suffix: string): string {
  return withCompanyQuery(`/api/workers${suffix}`, companyId);
}

export async function fetchHireOnboardingTemplate(companyId: string | null): Promise<HireTemplate> {
  return apiFetch<HireTemplate>(path(companyId, "/hire-onboarding/template"));
}

export async function saveHireOnboardingTemplate(
  companyId: string | null,
  body: { name?: string; items: HireTemplateItemWrite[] },
): Promise<HireTemplate> {
  return apiFetch<HireTemplate>(path(companyId, "/hire-onboarding/template"), {
    method: "PUT",
    json: body,
  });
}

export async function fetchHireOnboardingPackets(
  companyId: string | null,
  status?: HirePacketStatus,
): Promise<{ items: HirePacket[] }> {
  const extra = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<{ items: HirePacket[] }>(path(companyId, `/hire-onboarding/packets${extra}`));
}

export async function fetchHireOnboardingIncompleteSummary(
  companyId: string | null,
): Promise<HireIncompleteSummary> {
  return apiFetch<HireIncompleteSummary>(path(companyId, "/hire-onboarding/incomplete-summary"));
}

export async function fetchWorkerHireOnboarding(
  companyId: string | null,
  userId: string,
): Promise<HirePacket> {
  return apiFetch<HirePacket>(path(companyId, `/${encodeURIComponent(userId)}/hire-onboarding`));
}

export async function ensureWorkerHireOnboarding(
  companyId: string | null,
  userId: string,
): Promise<HirePacket> {
  return apiFetch<HirePacket>(path(companyId, `/${encodeURIComponent(userId)}/hire-onboarding`), {
    method: "POST",
  });
}

export async function completeHireOnboardingItem(
  companyId: string | null,
  userId: string,
  itemId: string,
  body?: { signature_name?: string; signed_ack?: boolean },
): Promise<HirePacket> {
  return apiFetch<HirePacket>(
    path(companyId, `/${encodeURIComponent(userId)}/hire-onboarding/items/${encodeURIComponent(itemId)}/complete`),
    { method: "POST", json: body ?? {} },
  );
}
