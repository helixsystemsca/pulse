"use client";

/**
 * Infrastructure & RTLS: gateways, tags, zones, worker and equipment tag assignment, automation.
 */
import { Loader2, MapPin, Radio, Settings2, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";
import type { WorkerRow } from "@/lib/workersService";
import { activityRowMatchesTest, type DetectionMatchType, type DetectionTestTarget } from "@/lib/detectionTest";
import { emitOnboardingMaybeUpdated } from "@/lib/onboarding-events";
import { normalizeMacKey } from "@/lib/macNormalize";
import {
  fetchEquipmentList as fetchFacilityEquipmentRows,
  type FacilityEquipmentRow,
} from "@/lib/equipmentService";
import {
  assignBleDevice,
  createBleDevice,
  createEquipment,
  createGateway,
  createZone,
  fetchBleDevices,
  fetchEquipmentList,
  fetchFeatureConfigs,
  fetchGatewayStatus,
  fetchGateways,
  fetchRecentActivity,
  fetchZones,
  patchFeatureConfig,
  patchGateway,
  type BleDeviceOut,
  type EquipmentOut,
  type GatewayOut,
  type GatewayStatusRow,
  type ZoneOut,
} from "@/lib/setup-api";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssignmentModal } from "@/components/setup/AssignmentModal";
import { AssignmentsOverview } from "@/components/setup/AssignmentsOverview";
import { ConfigPanel } from "@/components/setup/ConfigPanel";
import { DeviceHealthPanel } from "@/components/setup/DeviceHealthPanel";
import { DeviceCard } from "@/components/setup/DeviceCard";
import { LiveActivityFeed } from "@/components/setup/LiveActivityFeed";
import { SetupProgress } from "@/components/setup/SetupProgress";
import { ZoneCard } from "@/components/setup/ZoneCard";
import { ZoneMapSection } from "@/components/setup/ZoneMapSection";

type CompanyOption = { id: string; name: string };

type TabId = "devices" | "workers" | "zones" | "automation";

const TABS: { id: TabId; label: string; icon: typeof Radio }[] = [
  { id: "devices", label: "Gateways & sensors", icon: Radio },
  { id: "workers", label: "Workers", icon: Users },
  { id: "zones", label: "Zones", icon: MapPin },
  { id: "automation", label: "Automation", icon: Settings2 },
];

const FIELD =
  "mt-1.5 w-full rounded-md border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-500";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted dark:text-gray-500";
const BTN_PRIMARY =
  "rounded-md bg-[#2B4C7E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";
const TAB_ACTIVE =
  "border-[#2B4C7E] bg-[#ebf2ff] text-[#2B4C7E] shadow-sm dark:border-sky-500/45 dark:bg-[#1e3a5f] dark:text-sky-100";
const TAB_IDLE =
  "border-transparent bg-white/60 text-pulse-muted hover:border-slate-200 hover:text-pulse-navy dark:bg-[#1F2937]/90 dark:text-gray-400 dark:hover:border-[#374151] dark:hover:bg-[#374151] dark:hover:text-gray-100";

function companyQs(companyId: string | null): string {
  return companyId ? `company_id=${encodeURIComponent(companyId)}` : "";
}

function withCompany(path: string, companyId: string | null): string {
  const qs = companyQs(companyId);
  if (!qs) return path;
  return path.includes("?") ? `${path}&${qs}` : `${path}?${qs}`;
}

function normName(s: string): string {
  return s.trim().toLowerCase();
}

/** Select value for RTLS tool rows vs facility registry rows (API requires tool id on assign). */
function toolSelectValue(toolId: string): string {
  return `t:${toolId}`;
}

function facilitySelectValue(facilityId: string): string {
  return `f:${facilityId}`;
}

export function SetupApp() {
  const searchParams = useSearchParams();
  const session = readSession();
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const sessionCompanyId = session?.company_id ?? null;

  const [companyPick, setCompanyPick] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const effectiveCompanyId = isSystemAdmin ? companyPick : sessionCompanyId;
  const dataEnabled = Boolean(effectiveCompanyId);

  const [tab, setTab] = useState<TabId>("devices");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "devices" || t === "workers" || t === "zones" || t === "automation") {
      setTab(t);
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gateways, setGateways] = useState<GatewayOut[]>([]);
  const [gwStatus, setGwStatus] = useState<GatewayStatusRow[]>([]);
  const [bleDevices, setBleDevices] = useState<BleDeviceOut[]>([]);
  const [equipment, setEquipment] = useState<EquipmentOut[]>([]);
  const [facilityEquipment, setFacilityEquipment] = useState<FacilityEquipmentRow[]>([]);
  const [zones, setZones] = useState<ZoneOut[]>([]);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [features, setFeatures] = useState<Record<string, Record<string, unknown>>>({});

  const [assignBle, setAssignBle] = useState<BleDeviceOut | null>(null);
  const [zonePickGateway, setZonePickGateway] = useState<GatewayOut | null>(null);
  const [assignTargetId, setAssignTargetId] = useState("");
  const [toolQuickCreateName, setToolQuickCreateName] = useState("");
  const [creatingTrackedAsset, setCreatingTrackedAsset] = useState(false);

  const [gwName, setGwName] = useState("");
  const [gwIdent, setGwIdent] = useState("");
  const [gwZoneId, setGwZoneId] = useState("");

  const [bleName, setBleName] = useState("");
  const [bleMac, setBleMac] = useState("");
  const [bleType, setBleType] = useState<"worker_tag" | "equipment_tag">("worker_tag");

  const [zoneName, setZoneName] = useState("");
  const [zoneDesc, setZoneDesc] = useState("");

  const [detectionTarget, setDetectionTarget] = useState<DetectionTestTarget | null>(null);
  const [detectionSinceMs, setDetectionSinceMs] = useState<number | null>(null);
  const [detectionFlash, setDetectionFlash] = useState<{
    kind: "ble" | "gateway";
    id: string;
    matchType: DetectionMatchType;
    loggedAt: number;
    details: { payload: Record<string, unknown>; created_at: string | null };
  } | null>(null);
  const testAlreadyMatchedRef = useRef(false);
  const lastTestMatchRef = useRef<{
    matchType: DetectionMatchType;
    payload: Record<string, unknown>;
    timestamp: number;
  } | null>(null);

  const statusByGatewayId = useMemo(() => {
    const m = new Map<string, GatewayStatusRow>();
    for (const r of gwStatus) m.set(r.id, r);
    return m;
  }, [gwStatus]);

  const zoneNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const z of zones) m.set(z.id, z.name);
    return m;
  }, [zones]);

  const workerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workers) m.set(w.id, w.full_name || w.email);
    return m;
  }, [workers]);

  const applyLiveDeviceData = useCallback(
    (gw: GatewayOut[], st: GatewayStatusRow[], ble: BleDeviceOut[]) => {
      setGateways(gw);
      setGwStatus(st);
      setBleDevices(ble);
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!effectiveCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const [gw, st, ble, eq, facEq, zn, fc, wrRes] = await Promise.all([
        fetchGateways(isSystemAdmin ? effectiveCompanyId : null),
        fetchGatewayStatus(isSystemAdmin ? effectiveCompanyId : null),
        fetchBleDevices(isSystemAdmin ? effectiveCompanyId : null),
        fetchEquipmentList(isSystemAdmin ? effectiveCompanyId : null),
        fetchFacilityEquipmentRows(),
        fetchZones(isSystemAdmin ? effectiveCompanyId : null),
        fetchFeatureConfigs(isSystemAdmin ? effectiveCompanyId : null),
        apiFetch<{ items: WorkerRow[] }>(withCompany("/api/workers", isSystemAdmin ? effectiveCompanyId : null)),
      ]);
      applyLiveDeviceData(gw, st, ble);
      setEquipment(eq);
      setFacilityEquipment(facEq);
      setZones(zn);
      setFeatures(fc.features ?? {});
      setWorkers(wrRes.items ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load setup data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, isSystemAdmin, applyLiveDeviceData]);

  const refreshLiveDevices = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const [gw, st, ble] = await Promise.all([
        fetchGateways(isSystemAdmin ? effectiveCompanyId : null),
        fetchGatewayStatus(isSystemAdmin ? effectiveCompanyId : null),
        fetchBleDevices(isSystemAdmin ? effectiveCompanyId : null),
      ]);
      applyLiveDeviceData(gw, st, ble);
    } catch {
      /* keep stale data on poll failure */
    }
  }, [effectiveCompanyId, isSystemAdmin, applyLiveDeviceData]);

  const devicePollMs = tab === "devices" ? 5000 : 20000;
  useEffect(() => {
    if (!dataEnabled) return;
    const id = window.setInterval(() => {
      void refreshLiveDevices();
    }, devicePollMs);
    return () => window.clearInterval(id);
  }, [dataEnabled, devicePollMs, refreshLiveDevices]);

  useEffect(() => {
    if (!detectionTarget || detectionSinceMs == null || !effectiveCompanyId) return;
    const run = async () => {
      try {
        if (testAlreadyMatchedRef.current) return;
        const data = await fetchRecentActivity(isSystemAdmin ? effectiveCompanyId : null, 50);
        if (testAlreadyMatchedRef.current) return;
        const rows: {
          event_type: string;
          payload: Record<string, unknown>;
          created_at: string | null;
        }[] = data.events.map((e) => ({
          event_type: e.event_type,
          payload: e.payload ?? {},
          created_at: e.created_at,
        }));
        const sorted = rows
          .filter((r) => r.created_at)
          .sort((a, b) => Date.parse(b.created_at!) - Date.parse(a.created_at!));
        for (const r of sorted) {
          const matchType = activityRowMatchesTest(detectionTarget, r, detectionSinceMs);
          if (matchType) {
            if (testAlreadyMatchedRef.current) return;
            testAlreadyMatchedRef.current = true;
            const id =
              detectionTarget.kind === "ble" ? detectionTarget.deviceId : detectionTarget.gatewayId;
            const kind = detectionTarget.kind;
            const payload = { ...(r.payload ?? {}) };
            const loggedAt = Date.now();
            lastTestMatchRef.current = { matchType, payload, timestamp: loggedAt };
            console.debug("[Helix setup] test match", {
              type: matchType,
              source: kind,
              id,
              payload,
              timestamp: loggedAt,
            });
            setDetectionFlash({
              kind,
              id,
              matchType,
              loggedAt,
              details: { payload, created_at: r.created_at ?? null },
            });
            setDetectionTarget(null);
            setDetectionSinceMs(null);
            window.setTimeout(() => setDetectionFlash(null), 5200);
            return;
          }
        }
      } catch {
        /* ignore */
      }
    };
    void run();
    const iv = window.setInterval(() => void run(), 2000);
    return () => window.clearInterval(iv);
  }, [detectionTarget, detectionSinceMs, effectiveCompanyId, isSystemAdmin]);

  useEffect(() => {
    if (!isSystemAdmin || !session?.access_token) return;
    void (async () => {
      try {
        const rows = await apiFetch<CompanyOption[]>(`/api/system/companies?include_inactive=false&q=`);
        setCompanies(rows.map((r) => ({ id: r.id, name: r.name })));
      } catch {
        setCompanies([]);
      }
    })();
  }, [isSystemAdmin, session?.access_token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setupSteps = useMemo(() => {
    const gatewayAdded = gateways.length > 0;
    const zoneCreated = zones.length > 0;
    const zoneAssignedToGateway = gateways.some((g) => Boolean(g.zone_id));
    const tagRegistered = bleDevices.length > 0;
    const tagAssigned = bleDevices.some((b) => Boolean(b.assigned_worker_id || b.assigned_equipment_id));
    const trackingEnabled = Boolean(features.proximity_tracking?.enabled ?? true);
    return {
      gatewayAdded,
      zoneCreated,
      zoneAssignedToGateway,
      tagRegistered,
      tagAssigned,
      trackingEnabled,
      all:
        gatewayAdded &&
        zoneCreated &&
        zoneAssignedToGateway &&
        tagRegistered &&
        tagAssigned &&
        trackingEnabled,
    };
  }, [gateways, zones, bleDevices, features]);

  const progressItems = useMemo(
    () => [
      { id: "gw", label: "Gateway added", done: setupSteps.gatewayAdded },
      { id: "zone-create", label: "Zone created", done: setupSteps.zoneCreated },
      { id: "zone-gw", label: "Zone assigned to gateway", done: setupSteps.zoneAssignedToGateway },
      { id: "tag-reg", label: "Tag registered", done: setupSteps.tagRegistered },
      { id: "tag-assign", label: "Tag assigned (to worker or equipment)", done: setupSteps.tagAssigned },
      { id: "track", label: "Tracking enabled", done: setupSteps.trackingEnabled },
    ],
    [setupSteps],
  );

  const overviewData = useMemo(() => {
    const workersMapped = workers.map((w) => {
      const tag = bleDevices.find((b) => b.type === "worker_tag" && b.assigned_worker_id === w.id);
      return { id: w.id, name: w.full_name || w.email, tag: tag ? tag.name : null };
    });
    const assignedCount = bleDevices.filter((b) => b.assigned_worker_id || b.assigned_equipment_id).length;
    const unassignedCount = bleDevices.length - assignedCount;
    const tagSummary = {
      registered: bleDevices.length,
      assigned: assignedCount,
      unassigned: unassignedCount,
    };
    const zoneMapped = zones.map((z) => ({
      id: z.id,
      name: z.name,
      gateways: gateways.filter((g) => g.zone_id === z.id).map((g) => g.name),
    }));
    return { workersMapped, tagSummary, zoneMapped };
  }, [workers, bleDevices, zones, gateways]);

  const unassignedBle = useMemo(
    () => bleDevices.filter((b) => !b.assigned_worker_id && !b.assigned_equipment_id),
    [bleDevices],
  );

  const assignedBleOnly = useMemo(
    () => bleDevices.filter((b) => Boolean(b.assigned_worker_id || b.assigned_equipment_id)),
    [bleDevices],
  );

  const prevBleSeenRef = useRef<Record<string, string | undefined>>({});
  const [blePingHistory, setBlePingHistory] = useState<Record<string, number[]>>({});
  useEffect(() => {
    setBlePingHistory((hist) => {
      let changed = false;
      const next = { ...hist };
      for (const b of bleDevices) {
        const cur = b.last_seen_at ?? undefined;
        if (cur && cur !== prevBleSeenRef.current[b.id]) {
          const t = Date.parse(cur);
          if (!Number.isNaN(t)) {
            next[b.id] = [...(next[b.id] ?? []), t].slice(-40);
            changed = true;
          }
        }
        prevBleSeenRef.current[b.id] = cur;
      }
      return changed ? next : hist;
    });
  }, [bleDevices]);

  const feedResolveWorker = useCallback(
    (id: string) => workerNameById.get(id) ?? `${id.slice(0, 8)}…`,
    [workerNameById],
  );
  const feedResolveEquipment = useCallback(
    (id: string) => equipment.find((e) => e.id === id)?.name ?? `${id.slice(0, 8)}…`,
    [equipment],
  );
  const activityPinOptions = useMemo(
    () => ({
      gateways: gateways.map((g) => ({ id: g.id, label: g.name })),
      ble: bleDevices.map((b) => ({ mac: b.mac_address, label: b.name })),
    }),
    [gateways, bleDevices],
  );

  const warnAssignZone = useCallback(() => {
    const g = gateways.find((x) => !x.zone_id);
    if (g) {
      setTab("devices");
      setZonePickGateway(g);
      setAssignTargetId(g.zone_id ?? "");
    }
  }, [gateways]);

  const warnAssignWorkerTag = useCallback(() => {
    const b = bleDevices.find(
      (x) =>
        x.type === "worker_tag" && !x.assigned_worker_id && !x.assigned_equipment_id,
    );
    if (b) {
      setTab("devices");
      setAssignBle(b);
      setAssignTargetId("");
    }
  }, [bleDevices]);

  const warnAssignEquipmentTag = useCallback(() => {
    const b = bleDevices.find(
      (x) =>
        x.type === "equipment_tag" && !x.assigned_equipment_id && !x.assigned_worker_id,
    );
    if (b) {
      setTab("devices");
      setAssignBle(b);
      setAssignTargetId("");
      setToolQuickCreateName("");
    }
  }, [bleDevices]);

  const setupWarnings = useMemo(() => {
    const w: { id: string; text: string; action?: { label: string; onClick: () => void } }[] = [];
    if (gateways.some((g) => !g.zone_id)) {
      w.push({
        id: "gw-zone",
        text: "One or more gateways have no zone — assign zones for accurate coverage.",
        action: { label: "Assign zone", onClick: warnAssignZone },
      });
    }
    const unassignedWorker = bleDevices.filter(
      (b) => b.type === "worker_tag" && !b.assigned_worker_id && !b.assigned_equipment_id,
    );
    if (unassignedWorker.length > 0) {
      w.push({
        id: "ble-worker",
        text: `${unassignedWorker.length} worker tag(s) are unassigned — assign them on this page.`,
        action: { label: "Assign worker tag", onClick: warnAssignWorkerTag },
      });
    }
    const unassignedEquip = bleDevices.filter(
      (b) => b.type === "equipment_tag" && !b.assigned_equipment_id && !b.assigned_worker_id,
    );
    if (unassignedEquip.length > 0) {
      w.push({
        id: "ble-equip",
        text: `${unassignedEquip.length} equipment tag(s) are unassigned — assign each to a tracked asset below.`,
        action: { label: "Assign equipment tag", onClick: warnAssignEquipmentTag },
      });
    }
    return w;
  }, [gateways, bleDevices, warnAssignZone, warnAssignWorkerTag, warnAssignEquipmentTag]);

  const startBleDetectionTest = useCallback((d: BleDeviceOut) => {
    testAlreadyMatchedRef.current = false;
    setDetectionSinceMs(Date.now() - 1000);
    setDetectionTarget({
      kind: "ble",
      deviceId: d.id,
      macKey: normalizeMacKey(d.mac_address),
    });
  }, []);

  const startGatewayDetectionTest = useCallback((g: GatewayOut) => {
    testAlreadyMatchedRef.current = false;
    setDetectionSinceMs(Date.now() - 1000);
    setDetectionTarget({ kind: "gateway", gatewayId: g.id });
  }, []);

  const onAddGateway = async () => {
    if (!gwName.trim() || !gwIdent.trim()) return;
    try {
      await createGateway(isSystemAdmin ? effectiveCompanyId : null, {
        name: gwName.trim(),
        identifier: gwIdent.trim(),
        zone_id: gwZoneId || null,
      });
      setGwName("");
      setGwIdent("");
      setGwZoneId("");
      await refresh();
      emitOnboardingMaybeUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not add gateway");
    }
  };

  const onAddBle = async () => {
    if (!bleName.trim() || !bleMac.trim()) return;
    try {
      await createBleDevice(isSystemAdmin ? effectiveCompanyId : null, {
        name: bleName.trim(),
        mac_address: bleMac.trim(),
        type: bleType,
      });
      setBleName("");
      setBleMac("");
      await refresh();
      emitOnboardingMaybeUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not register tag");
    }
  };

  const onAddZone = async () => {
    if (!zoneName.trim()) return;
    try {
      await createZone(isSystemAdmin ? effectiveCompanyId : null, {
        name: zoneName.trim(),
        description: zoneDesc.trim() || null,
      });
      setZoneName("");
      setZoneDesc("");
      await refresh();
      emitOnboardingMaybeUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create zone");
    }
  };

  const resolveTrackedToolIdForAssign = async (raw: string): Promise<string | null> => {
    if (!raw) return null;
    if (raw.startsWith("t:")) return raw.slice(2);
    if (raw.startsWith("f:")) {
      const fid = raw.slice(2);
      const fe = facilityEquipment.find((x) => x.id === fid);
      if (!fe) return null;
      const key = normName(fe.name);
      const existing = equipment.find((t) => normName(t.name) === key);
      if (existing) return existing.id;
      const row = await createEquipment(isSystemAdmin ? effectiveCompanyId : null, { name: fe.name.trim() });
      return row.id;
    }
    return raw;
  };

  const submitAssignBle = async () => {
    if (!assignBle || !assignTargetId) return;
    if (assignBle.type !== "worker_tag" && assignBle.type !== "equipment_tag") return;
    try {
      if (assignBle.type === "worker_tag") {
        await assignBleDevice(isSystemAdmin ? effectiveCompanyId : null, assignBle.id, {
          assigned_worker_id: assignTargetId,
          assigned_equipment_id: null,
        });
      } else {
        const toolId = await resolveTrackedToolIdForAssign(assignTargetId);
        if (!toolId) {
          setError("Could not resolve tracked asset for assignment.");
          return;
        }
        await assignBleDevice(isSystemAdmin ? effectiveCompanyId : null, assignBle.id, {
          assigned_worker_id: null,
          assigned_equipment_id: toolId,
        });
      }
      setAssignBle(null);
      setAssignTargetId("");
      setToolQuickCreateName("");
      await refresh();
    } catch {
      setError("Assignment failed");
    }
  };

  const submitQuickCreateTrackedAsset = async () => {
    if (!assignBle || assignBle.type !== "equipment_tag" || !toolQuickCreateName.trim()) return;
    setCreatingTrackedAsset(true);
    setError(null);
    try {
      const row = await createEquipment(isSystemAdmin ? effectiveCompanyId : null, {
        name: toolQuickCreateName.trim(),
      });
      setToolQuickCreateName("");
      await refresh();
      setAssignTargetId(toolSelectValue(row.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create tracked asset");
    } finally {
      setCreatingTrackedAsset(false);
    }
  };

  const submitGatewayZone = async () => {
    if (!zonePickGateway) return;
    try {
      await patchGateway(isSystemAdmin ? effectiveCompanyId : null, zonePickGateway.id, {
        zone_id: assignTargetId || null,
      });
      setZonePickGateway(null);
      setAssignTargetId("");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not update gateway zone");
    }
  };

  const saveProx = async (body: { enabled: boolean; config: Record<string, unknown> }) => {
    setSavingConfig(true);
    setError(null);
    try {
      const res = await patchFeatureConfig(isSystemAdmin ? effectiveCompanyId : null, "proximity_tracking", body);
      setFeatures(res.features ?? {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingConfig(false);
    }
  };

  const saveSop = async (body: { enabled: boolean; config: Record<string, unknown> }) => {
    setSavingConfig(true);
    setError(null);
    try {
      const res = await patchFeatureConfig(isSystemAdmin ? effectiveCompanyId : null, "sop_alerts", body);
      setFeatures(res.features ?? {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingConfig(false);
    }
  };

  const unassignWorkerLabels = useMemo(() => {
    if (!assignBle || assignBle.type !== "worker_tag") return [];
    return workers.map((w) => ({ id: w.id, label: w.full_name || w.email }));
  }, [assignBle, workers]);

  const trackedAssetOptions = useMemo(() => {
    const toolNames = new Set(equipment.map((t) => normName(t.name)));
    const fromTools = equipment.map((t) => ({
      value: toolSelectValue(t.id),
      label: t.name,
    }));
    const fromFacility = facilityEquipment
      .filter((fe) => !toolNames.has(normName(fe.name)))
      .map((fe) => ({
        value: facilitySelectValue(fe.id),
        label: `${fe.name} — facility equipment`,
      }));
    return [...fromTools, ...fromFacility].sort((a, b) => a.label.localeCompare(b.label));
  }, [equipment, facilityEquipment]);

  if (isSystemAdmin && !companyPick) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Zones & Devices"
          description="Select a company to manage gateways, tags, and zones."
          icon={MapPin}
        />
        <div className="app-page-inset p-6">
          <label className={LABEL}>Company</label>
          <select
            className={FIELD}
            value={companyPick ?? ""}
            onChange={(e) => setCompanyPick(e.target.value || null)}
          >
            <option value="">Choose company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Zones & Devices"
        description="Guided setup — gateways (ESP32), BLE tags, zones, and tracking health. Assign worker tags to people and equipment tags to tracked assets here. Tune automation without a rule builder."
        icon={MapPin}
      />
      {isSystemAdmin ? (
        <div className="flex max-w-md flex-col gap-1">
          <label className={LABEL}>Company context</label>
          <select
            className={FIELD}
            value={companyPick ?? ""}
            onChange={(e) => setCompanyPick(e.target.value || null)}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {dataEnabled ? <SetupProgress items={progressItems} warnings={setupWarnings} /> : null}

      {dataEnabled ? (
        <AssignmentsOverview
          workers={overviewData.workersMapped}
          zoneRows={overviewData.zoneMapped}
          tagSummary={overviewData.tagSummary}
        />
      ) : null}

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-red-500/35 dark:bg-red-950/55 dark:text-red-100">
          {error}
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === id ? TAB_ACTIVE : TAB_IDLE
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      {loading && !gateways.length && !bleDevices.length ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#2B4C7E]" aria-label="Loading" />
        </div>
      ) : null}

      {tab === "devices" && dataEnabled ? (
        <div className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-pulse-navy">Gateways</h2>
            <div className="grid gap-4 sm:grid-cols-1">
              {gateways.map((g) => {
                const stRow = statusByGatewayId.get(g.id);
                const st = stRow?.status ?? "offline";
                const online = st === "online";
                const lastHeard = stRow?.last_seen_at ?? g.last_seen_at ?? null;
                const listening =
                  detectionTarget?.kind === "gateway" && detectionTarget.gatewayId === g.id;
                const flash = detectionFlash?.kind === "gateway" && detectionFlash.id === g.id;
                return (
                  <DeviceCard
                    key={g.id}
                    variant="gateway"
                    gateway={g}
                    operationalStatus={online ? "online" : "offline"}
                    lastHeardAt={lastHeard}
                    secondsSinceLastSeen={stRow?.seconds_since_last_seen ?? null}
                    zoneLabel={g.zone_id ? zoneNameById.get(g.zone_id) ?? g.zone_id : null}
                    onChangeZone={() => {
                      setZonePickGateway(g);
                      setAssignTargetId(g.zone_id ?? "");
                    }}
                    testListening={listening}
                    testSuccessFlash={flash}
                    testMatchKind={
                      detectionFlash?.kind === "gateway" && detectionFlash.id === g.id
                        ? detectionFlash.matchType
                        : undefined
                    }
                    testMatchDebug={
                      detectionFlash?.kind === "gateway" && detectionFlash.id === g.id
                        ? { loggedAt: detectionFlash.loggedAt, matchType: detectionFlash.matchType }
                        : null
                    }
                    testMatchDetails={
                      detectionFlash?.kind === "gateway" && detectionFlash.id === g.id
                        ? detectionFlash.details
                        : null
                    }
                    onTestDetection={() => startGatewayDetectionTest(g)}
                  />
                );
              })}
              {gateways.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-pulse-muted dark:border-[#374151] dark:bg-[#0F172A]/80 dark:text-gray-500">
                  No gateways yet. Add your first ESP32 edge device below.
                </p>
              ) : null}
            </div>
            <div className="rounded-md border border-slate-200/80 bg-white p-5 shadow-card dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              <h3 className="font-semibold text-pulse-navy">Add gateway</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={LABEL}>Name</label>
                  <input className={FIELD} value={gwName} onChange={(e) => setGwName(e.target.value)} placeholder="Shop floor west" />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>Identifier (MAC or device ID)</label>
                  <input className={FIELD} value={gwIdent} onChange={(e) => setGwIdent(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>Zone</label>
                  <select className={FIELD} value={gwZoneId} onChange={(e) => setGwZoneId(e.target.value)}>
                    <option value="">— Optional —</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="button" className={`mt-4 ${BTN_PRIMARY}`} onClick={() => void onAddGateway()}>
                Add gateway
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-pulse-navy">Tags</h2>
            {unassignedBle.length > 0 ? (
              <div className="rounded-md border border-amber-200/90 bg-amber-50/50 p-4 ring-1 ring-amber-200/60 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-950">Unassigned tags</h3>
                    <p className="mt-0.5 text-xs text-amber-900/80">
                      Assign worker tags to roster members and equipment tags to tracked assets (same name as a facility item is a good default).
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-200/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-950">
                    {unassignedBle.length} need attention
                  </span>
                </div>
                <div className="mt-4 grid gap-4">
                  {unassignedBle.map((b) => {
                    const listening =
                      detectionTarget?.kind === "ble" && detectionTarget.deviceId === b.id;
                    const flash = detectionFlash?.kind === "ble" && detectionFlash.id === b.id;
                    const isWorkerTag = b.type === "worker_tag";
                    return (
                      <DeviceCard
                        key={`unassigned-${b.id}`}
                        variant="ble"
                        device={b}
                        assignedLabel={null}
                        emphasizeUnassigned
                        disableAssignment={false}
                        assignmentHint={null}
                        onAssign={() => {
                          setAssignBle(b);
                          setAssignTargetId(
                            isWorkerTag
                              ? ""
                              : b.assigned_equipment_id
                                ? toolSelectValue(b.assigned_equipment_id)
                                : "",
                          );
                          setToolQuickCreateName("");
                        }}
                        testListening={listening}
                        testSuccessFlash={flash}
                        testMatchKind={
                          detectionFlash?.kind === "ble" && detectionFlash.id === b.id
                            ? detectionFlash.matchType
                            : undefined
                        }
                        testMatchDebug={
                          detectionFlash?.kind === "ble" && detectionFlash.id === b.id
                            ? { loggedAt: detectionFlash.loggedAt, matchType: detectionFlash.matchType }
                            : null
                        }
                        testMatchDetails={
                          detectionFlash?.kind === "ble" && detectionFlash.id === b.id
                            ? detectionFlash.details
                            : null
                        }
                        signalHistoryMs={blePingHistory[b.id]}
                        onTestDetection={() => startBleDetectionTest(b)}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}
            {assignedBleOnly.length > 0 ? (
              <p className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">Assigned tags</p>
            ) : null}
            <div className="grid gap-4">
              {assignedBleOnly.map((b) => {
                let assignedLabel: string | null = null;
                if (b.assigned_worker_id) assignedLabel = workerNameById.get(b.assigned_worker_id) ?? b.assigned_worker_id;
                if (b.assigned_equipment_id) {
                  const eq = equipment.find((x) => x.id === b.assigned_equipment_id);
                  assignedLabel = eq?.name ?? b.assigned_equipment_id;
                }
                const listening =
                  detectionTarget?.kind === "ble" && detectionTarget.deviceId === b.id;
                const flash = detectionFlash?.kind === "ble" && detectionFlash.id === b.id;
                const isWorkerTag = b.type === "worker_tag";
                return (
                  <DeviceCard
                    key={b.id}
                    variant="ble"
                    device={b}
                    assignedLabel={assignedLabel}
                    disableAssignment={false}
                    onAssign={() => {
                      setAssignBle(b);
                      setAssignTargetId(
                        isWorkerTag
                          ? (b.assigned_worker_id ?? "")
                          : b.assigned_equipment_id
                            ? toolSelectValue(b.assigned_equipment_id)
                            : "",
                      );
                      setToolQuickCreateName("");
                    }}
                    testListening={listening}
                    testSuccessFlash={flash}
                    testMatchKind={
                      detectionFlash?.kind === "ble" && detectionFlash.id === b.id
                        ? detectionFlash.matchType
                        : undefined
                    }
                    testMatchDebug={
                      detectionFlash?.kind === "ble" && detectionFlash.id === b.id
                        ? { loggedAt: detectionFlash.loggedAt, matchType: detectionFlash.matchType }
                        : null
                    }
                    testMatchDetails={
                      detectionFlash?.kind === "ble" && detectionFlash.id === b.id
                        ? detectionFlash.details
                        : null
                    }
                    signalHistoryMs={blePingHistory[b.id]}
                    onTestDetection={() => startBleDetectionTest(b)}
                  />
                );
              })}
              {bleDevices.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-pulse-muted dark:border-[#374151] dark:bg-[#0F172A]/80 dark:text-gray-500">
                  No BLE tags yet. Register worker or equipment tags below.
                </p>
              ) : null}
            </div>
            <div className="rounded-md border border-slate-200/80 bg-white p-5 shadow-card dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              <h3 className="font-semibold text-pulse-navy">Register tag</h3>
              <div className="mt-4 grid gap-3">
                <div>
                  <label className={LABEL}>Name</label>
                  <input className={FIELD} value={bleName} onChange={(e) => setBleName(e.target.value)} placeholder="West dock tag" />
                </div>
                <div>
                  <label className={LABEL}>MAC address</label>
                  <input className={FIELD} value={bleMac} onChange={(e) => setBleMac(e.target.value)} placeholder="00:1A:7D:DA:71:13" />
                </div>
                <div>
                  <label className={LABEL}>Tag role</label>
                  <select
                    className={FIELD}
                    value={bleType}
                    onChange={(e) => setBleType(e.target.value as "worker_tag" | "equipment_tag")}
                  >
                    <option value="worker_tag">Worker tag</option>
                    <option value="equipment_tag">Equipment tag</option>
                  </select>
                </div>
              </div>
              <button type="button" className={`mt-4 ${BTN_PRIMARY}`} onClick={() => void onAddBle()}>
                Register tag
              </button>
            </div>
          </div>
        </div>

        <DeviceHealthPanel gateways={gateways} gatewayStatus={gwStatus} bleDevices={bleDevices} />

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-pulse-navy">Recent activity</h2>
          <p className="text-sm text-pulse-muted">Live automation and detection events for this company.</p>
          <LiveActivityFeed
            companyId={effectiveCompanyId}
            isSystemAdminBase={isSystemAdmin}
            pollMs={8000}
            fetchLimit={80}
            maxBlocks={20}
            resolveWorkerName={feedResolveWorker}
            resolveEquipmentName={feedResolveEquipment}
            pinOptions={activityPinOptions}
          />
        </div>

        <ZoneMapSection
          zones={zones}
          gateways={gateways}
          tagCount={bleDevices.length}
          assignedTagCount={bleDevices.filter((b) => b.assigned_worker_id || b.assigned_equipment_id).length}
        />
        </div>
      ) : null}

      {tab === "workers" && dataEnabled ? (
        <div className="space-y-4">
          <p className="text-sm text-pulse-muted">
            Assign <strong className="text-pulse-navy">worker tags</strong> from the{" "}
            <strong className="text-pulse-navy">Gateways &amp; sensors</strong> tab, or use Assign on each tag card. Roster
            for reference:
          </p>
          <div className="overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-card dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Worker tag</th>
                  <th className="px-4 py-3 text-right">Assign</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => {
                  const tag = bleDevices.find((b) => b.type === "worker_tag" && b.assigned_worker_id === w.id);
                  return (
                    <tr key={w.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-pulse-navy">{w.full_name || w.email}</td>
                      <td className="px-4 py-3 capitalize text-pulse-muted">{w.role.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-pulse-muted">{tag ? tag.name : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setTab("devices");
                            setToolQuickCreateName("");
                            if (tag) {
                              setAssignBle(tag);
                              setAssignTargetId(w.id);
                              return;
                            }
                            const unassigned = bleDevices.find(
                              (b) =>
                                b.type === "worker_tag" &&
                                !b.assigned_worker_id &&
                                !b.assigned_equipment_id,
                            );
                            if (unassigned) {
                              setAssignBle(unassigned);
                              setAssignTargetId(w.id);
                            }
                          }}
                          className="text-xs font-semibold text-[#2B4C7E] hover:underline"
                        >
                          {tag ? "Reassign" : "Assign tag"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "zones" && dataEnabled ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {zones.map((z) => {
              const gatewayCount = gateways.filter((g) => g.zone_id === z.id).length;
              return <ZoneCard key={z.id} zone={z} gatewayCount={gatewayCount} />;
            })}
          </div>
          {zones.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-pulse-muted dark:border-[#374151] dark:bg-[#0F172A]/80 dark:text-gray-500">
              No zones yet. Create regions of your facility, then assign gateways.
            </p>
          ) : null}
          <div className="rounded-md border border-slate-200/80 bg-white p-5 shadow-card dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] md:max-w-lg">
            <h3 className="font-semibold text-pulse-navy">Create zone</h3>
            <label className={LABEL}>Name</label>
            <input className={FIELD} value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="Receiving" />
            <label className={`${LABEL} mt-3 block`}>Description</label>
            <input className={FIELD} value={zoneDesc} onChange={(e) => setZoneDesc(e.target.value)} placeholder="Optional" />
            <button type="button" className={`mt-4 ${BTN_PRIMARY}`} onClick={() => void onAddZone()}>
              Create zone
            </button>
          </div>
        </div>
      ) : null}

      {tab === "automation" && dataEnabled ? (
        <ConfigPanel
          proximity={features.proximity_tracking}
          sopAlerts={features.sop_alerts}
          saving={savingConfig}
          onSaveProximity={saveProx}
          onSaveSop={saveSop}
        />
      ) : null}

      <AssignmentModal
        open={Boolean(assignBle && (assignBle.type === "worker_tag" || assignBle.type === "equipment_tag"))}
        title={assignBle ? `Assign ${assignBle.name}` : ""}
        description={
          assignBle?.type === "equipment_tag"
            ? "Tracked assets (RTLS) or facility equipment rows appear below. Choosing facility equipment creates a matching tracked asset if needed."
            : "Pick a worker to carry this tag."
        }
        onClose={() => {
          setAssignBle(null);
          setAssignTargetId("");
          setToolQuickCreateName("");
        }}
      >
        {assignBle?.type === "worker_tag" ? (
          <>
            <label className={LABEL}>Worker</label>
            <select className={FIELD} value={assignTargetId} onChange={(e) => setAssignTargetId(e.target.value)}>
              <option value="">Select…</option>
              {unassignWorkerLabels.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {unassignWorkerLabels.length === 0 ? (
              <p className="mt-2 text-xs text-pulse-muted">
                No roster workers loaded. Add or invite people under Workforce, then refresh this page.
              </p>
            ) : null}
            <button type="button" className={`mt-4 w-full ${BTN_PRIMARY}`} onClick={() => void submitAssignBle()}>
              Save assignment
            </button>
          </>
        ) : assignBle?.type === "equipment_tag" ? (
          <>
            <label className={LABEL}>Tracked asset</label>
            <select className={FIELD} value={assignTargetId} onChange={(e) => setAssignTargetId(e.target.value)}>
              <option value="">Select…</option>
              {trackedAssetOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {trackedAssetOptions.length === 0 ? (
              <p className="mt-2 text-xs text-pulse-muted">
                No tracked assets or facility equipment yet. Use &quot;New tracked asset&quot; below or register items under
                Equipment.
              </p>
            ) : null}
            <div className="mt-4 rounded-md border border-slate-200/90 bg-slate-50/80 p-3 dark:border-[#374151] dark:bg-[#111827]/80">
              <p className="text-xs font-semibold text-pulse-navy dark:text-gray-200">New tracked asset</p>
              <p className="mt-1 text-[11px] text-pulse-muted">
                If nothing is listed yet, add a name and create — then save assignment.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  className={FIELD}
                  value={toolQuickCreateName}
                  onChange={(e) => setToolQuickCreateName(e.target.value)}
                  placeholder="e.g. CNC Mill 3"
                  disabled={creatingTrackedAsset}
                />
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  disabled={creatingTrackedAsset || !toolQuickCreateName.trim()}
                  onClick={() => void submitQuickCreateTrackedAsset()}
                >
                  {creatingTrackedAsset ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
            <button
              type="button"
              className={`mt-4 w-full ${BTN_PRIMARY}`}
              disabled={!assignTargetId}
              onClick={() => void submitAssignBle()}
            >
              Save assignment
            </button>
          </>
        ) : null}
      </AssignmentModal>

      <AssignmentModal
        open={Boolean(zonePickGateway)}
        title={zonePickGateway ? `Zone for ${zonePickGateway.name}` : ""}
        description="Gateways inherit coverage from the zone you select."
        onClose={() => {
          setZonePickGateway(null);
          setAssignTargetId("");
        }}
      >
        <label className={LABEL}>Zone</label>
        <select className={FIELD} value={assignTargetId} onChange={(e) => setAssignTargetId(e.target.value)}>
          <option value="">— None —</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
        <button type="button" className={`mt-4 w-full ${BTN_PRIMARY}`} onClick={() => void submitGatewayZone()}>
          Update gateway
        </button>
      </AssignmentModal>
    </div>
  );
}
