import type { OrgModuleSettingsRoot } from "./defaults";

const PREFIX = "pulse_org_module_settings_v1";

export function localStorageKeyForCompany(companyId: string | null): string | null {
  if (!companyId) return null;
  return `${PREFIX}_${encodeURIComponent(companyId)}`;
}

export function readModuleSettingsCache(companyId: string | null): Partial<OrgModuleSettingsRoot> | null {
  if (typeof window === "undefined") return null;
  const key = localStorageKeyForCompany(companyId);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    return typeof o === "object" && o !== null ? (o as Partial<OrgModuleSettingsRoot>) : null;
  } catch {
    return null;
  }
}

export function writeModuleSettingsCache(companyId: string | null, data: OrgModuleSettingsRoot): void {
  if (typeof window === "undefined") return;
  const key = localStorageKeyForCompany(companyId);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}
