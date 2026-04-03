/** Client helpers for `/api/v1` device hub + feature-config endpoints used by Equipment Setup. */
import { apiFetch } from "@/lib/api";

export type GatewayOut = {
  id: string;
  company_id: string;
  name: string;
  identifier: string;
  status: string;
  zone_id: string | null;
  last_seen_at: string | null;
};

export type BleDeviceOut = {
  id: string;
  company_id: string;
  name: string;
  mac_address: string;
  type: "worker_tag" | "equipment_tag" | string;
  assigned_worker_id: string | null;
  assigned_equipment_id: string | null;
  last_seen_at?: string | null;
};

export type EquipmentOut = {
  id: string;
  company_id: string;
  name: string;
  tag_id: string;
  zone_id: string | null;
  assigned_user_id: string | null;
  status: string;
};

export type ZoneOut = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  meta: Record<string, unknown>;
};

export type GatewayStatusRow = {
  id: string;
  name: string;
  zone_id: string | null;
  status: "online" | "offline" | string;
  last_seen_at: string | null;
  seconds_since_last_seen: number | null;
};

export type FeatureConfigsResponse = {
  features: Record<string, Record<string, unknown>>;
};

function companyQs(companyId: string | null): string {
  return companyId ? `company_id=${encodeURIComponent(companyId)}` : "";
}

function withCompany(path: string, companyId: string | null): string {
  const qs = companyQs(companyId);
  if (!qs) return path;
  return path.includes("?") ? `${path}&${qs}` : `${path}?${qs}`;
}

export async function fetchGateways(companyId: string | null): Promise<GatewayOut[]> {
  return apiFetch<GatewayOut[]>(withCompany("/api/v1/gateways", companyId));
}

export async function fetchGatewayStatus(companyId: string | null): Promise<GatewayStatusRow[]> {
  const res = await apiFetch<{ success: boolean; data: GatewayStatusRow[] }>(
    withCompany("/api/v1/gateways/status", companyId),
  );
  return res.data ?? [];
}

export async function fetchBleDevices(companyId: string | null): Promise<BleDeviceOut[]> {
  return apiFetch<BleDeviceOut[]>(withCompany("/api/v1/ble-devices", companyId));
}

export async function fetchEquipmentList(companyId: string | null): Promise<EquipmentOut[]> {
  return apiFetch<EquipmentOut[]>(withCompany("/api/v1/equipment", companyId));
}

export async function fetchZones(companyId: string | null): Promise<ZoneOut[]> {
  return apiFetch<ZoneOut[]>(withCompany("/api/v1/zones", companyId));
}

export async function fetchFeatureConfigs(companyId: string | null): Promise<FeatureConfigsResponse> {
  return apiFetch<FeatureConfigsResponse>(withCompany("/api/v1/feature-configs", companyId));
}

export type AutomationRecentActivityEvent = {
  id: string;
  event_type: string;
  created_at: string | null;
  payload: Record<string, unknown>;
};

export type AutomationRecentActivityLog = {
  id: string;
  type: string;
  severity: string | null;
  source_module: string | null;
  message: string;
  created_at: string | null;
  payload: Record<string, unknown>;
};

export type AutomationRecentActivityData = {
  events: AutomationRecentActivityEvent[];
  logs: AutomationRecentActivityLog[];
  active_states: unknown[];
};

export async function fetchRecentActivity(
  companyId: string | null,
  limit = 40,
): Promise<AutomationRecentActivityData> {
  const path = withCompany(`/api/v1/automation/debug/recent-activity?limit=${limit}`, companyId);
  const res = await apiFetch<{ success: boolean; data: AutomationRecentActivityData }>(path);
  return res.data ?? { events: [], logs: [], active_states: [] };
}

export async function patchFeatureConfig(
  companyId: string | null,
  featureName: string,
  body: { enabled?: boolean; config?: Record<string, unknown> },
): Promise<FeatureConfigsResponse> {
  return apiFetch<FeatureConfigsResponse>(withCompany(`/api/v1/feature-configs/${featureName}`, companyId), {
    method: "PATCH",
    json: body,
  });
}

export async function createGateway(
  companyId: string | null,
  body: { name: string; identifier: string; zone_id?: string | null },
): Promise<GatewayOut> {
  return apiFetch<GatewayOut>(withCompany("/api/v1/gateways", companyId), {
    method: "POST",
    json: body,
  });
}

export async function patchGateway(
  companyId: string | null,
  gatewayId: string,
  body: { zone_id?: string | null; name?: string },
): Promise<GatewayOut> {
  return apiFetch<GatewayOut>(withCompany(`/api/v1/gateways/${gatewayId}`, companyId), {
    method: "PATCH",
    json: body,
  });
}

export async function createBleDevice(
  companyId: string | null,
  body: {
    name: string;
    mac_address: string;
    type: "worker_tag" | "equipment_tag";
    assigned_worker_id?: string | null;
    assigned_equipment_id?: string | null;
  },
): Promise<BleDeviceOut> {
  return apiFetch<BleDeviceOut>(withCompany("/api/v1/ble-devices", companyId), {
    method: "POST",
    json: body,
  });
}

export async function assignBleDevice(
  companyId: string | null,
  bleId: string,
  body: { assigned_worker_id?: string | null; assigned_equipment_id?: string | null },
): Promise<BleDeviceOut> {
  return apiFetch<BleDeviceOut>(withCompany(`/api/v1/ble-devices/${bleId}/assign`, companyId), {
    method: "PATCH",
    json: body,
  });
}

export async function createEquipment(
  companyId: string | null,
  body: {
    name: string;
    type?: string | null;
    zone_id?: string | null;
    link_ble_device_id?: string | null;
  },
): Promise<EquipmentOut> {
  return apiFetch<EquipmentOut>(withCompany("/api/v1/equipment", companyId), {
    method: "POST",
    json: body,
  });
}

export async function linkEquipmentBle(
  companyId: string | null,
  equipmentId: string,
  bleDeviceId: string,
): Promise<BleDeviceOut> {
  return apiFetch<BleDeviceOut>(
    withCompany(`/api/v1/equipment/${equipmentId}/link-ble`, companyId),
    {
      method: "POST",
      json: { ble_device_id: bleDeviceId },
    },
  );
}

export async function createZone(
  companyId: string | null,
  body: { name: string; description?: string | null },
): Promise<ZoneOut> {
  return apiFetch<ZoneOut>(withCompany("/api/v1/zones", companyId), {
    method: "POST",
    json: body,
  });
}
