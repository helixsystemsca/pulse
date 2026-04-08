import { apiFetch } from "@/lib/api";
import type { OrgModuleSettingsRoot } from "./defaults";

function companyQs(companyId: string | null): string {
  return companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
}

export async function fetchOrgModuleSettings(companyId: string | null): Promise<OrgModuleSettingsRoot> {
  const r = await apiFetch<{ settings: OrgModuleSettingsRoot }>(`/api/v1/org/module-settings${companyQs(companyId)}`);
  return r.settings;
}

export async function patchOrgModuleSettings(
  companyId: string | null,
  patch: Partial<OrgModuleSettingsRoot>,
): Promise<OrgModuleSettingsRoot> {
  const r = await apiFetch<{ settings: OrgModuleSettingsRoot }>(`/api/v1/org/module-settings${companyQs(companyId)}`, {
    method: "PATCH",
    json: { settings: patch },
  });
  return r.settings;
}
