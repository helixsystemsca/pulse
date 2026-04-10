"use client";

import { ArrowLeft, Bluetooth, Camera, ClipboardList, History, Loader2, Wrench } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EquipmentPartsPanel } from "@/components/equipment/EquipmentPartsPanel";
import { Card } from "@/components/pulse/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { managerOrAbove } from "@/lib/pulse-roles";
import { useModuleSettings } from "@/providers/ModuleSettingsProvider";
import {
  fetchEquipment,
  fetchEquipmentParts,
  uploadEquipmentImage,
  type EquipmentLinkedWorkOrder,
  type EquipmentPartRow,
  type FacilityEquipmentDetail,
} from "@/lib/equipmentService";
import { useResolvedProtectedAssetSrc } from "@/lib/useResolvedProtectedAssetSrc";
import { fetchBleDevices, fetchEquipmentList, type BleDeviceOut, type EquipmentOut } from "@/lib/setup-api";

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusBadge(status: string): string {
  switch (status) {
    case "maintenance":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
    case "offline":
      return "bg-slate-100 text-pulse-muted ring-1 ring-slate-200/80";
    default:
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80";
  }
}

function woStatusBadge(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70";
    case "cancelled":
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80";
    case "in_progress":
      return "bg-sky-50 text-[#3182ce] ring-1 ring-sky-200/70";
    default:
      return "bg-slate-50 text-pulse-navy ring-1 ring-slate-200/70";
  }
}

type Props = { equipmentId: string };

function MaintenanceHistorySection({
  equipmentId,
  workOrders,
  revision = 0,
}: {
  equipmentId: string;
  workOrders: EquipmentLinkedWorkOrder[];
  /** Increment when parts change so the timeline refetches. */
  revision?: number;
}) {
  const [parts, setParts] = useState<EquipmentPartRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const rows = await fetchEquipmentParts(equipmentId);
        if (!cancelled) setParts(rows);
      } catch {
        if (!cancelled) setParts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [equipmentId, revision]);

  type Entry = { ts: number; dateLabel: string; primary: string; secondary: string };
  const entries = useMemo(() => {
    const out: Entry[] = [];
    for (const p of parts) {
      if (p.last_replaced_date) {
        const t = new Date(`${p.last_replaced_date}T12:00:00`).getTime();
        if (!Number.isNaN(t)) {
          out.push({
            ts: t,
            dateLabel: formatDate(p.last_replaced_date),
            primary: "Part replacement recorded",
            secondary: p.name,
          });
        }
      }
    }
    for (const wo of workOrders) {
      const t = new Date(wo.updated_at).getTime();
      if (!Number.isNaN(t)) {
        out.push({
          ts: t,
          dateLabel: formatDate(wo.updated_at),
          primary: `Work order: ${wo.title}`,
          secondary: `Status: ${wo.status.replace(/_/g, " ")}`,
        });
      }
    }
    out.sort((a, b) => b.ts - a.ts);
    return out;
  }, [parts, workOrders]);

  return (
    <section className="space-y-2">
      <h2 className={`${LABEL} inline-flex items-center gap-2`}>
        <History className="h-3.5 w-3.5" aria-hidden />
        Maintenance history
      </h2>
      <Card padding="md">
        {loading ? (
          <p className="text-sm text-pulse-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-pulse-muted">
            No history entries yet. Record part replacements or link work orders to this equipment to build a timeline.
          </p>
        ) : (
          <ul className="space-y-4 border-l-2 border-slate-200 pl-4">
            {entries.map((e, i) => (
              <li key={`${e.ts}-${i}`} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#2B4C7E] ring-2 ring-white" />
                <p className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">{e.dateLabel}</p>
                <p className="mt-0.5 font-medium text-pulse-navy">{e.primary}</p>
                <p className="text-xs text-pulse-muted">{e.secondary}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-pulse-muted">
          Combines last replacement dates from parts and linked work orders (by last update). Detailed event logging may be
          added in a future release.
        </p>
      </Card>
    </section>
  );
}

export function EquipmentDetailApp({ equipmentId }: Props) {
  const { session } = usePulseAuth();
  const canMutate = managerOrAbove(session);
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const assetMod = useModuleSettings("assets");

  const [data, setData] = useState<FacilityEquipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [maintenanceHistoryRevision, setMaintenanceHistoryRevision] = useState(0);
  const [rtlsBleDevices, setRtlsBleDevices] = useState<BleDeviceOut[]>([]);
  const [rtlsTrackedAssets, setRtlsTrackedAssets] = useState<EquipmentOut[]>([]);
  const [rtlsLoading, setRtlsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchEquipment(equipmentId);
      setData(d);
    } catch {
      setError("Could not load equipment.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [equipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    void (async () => {
      setRtlsLoading(true);
      try {
        const companyId = isSystemAdmin ? data.company_id : null;
        const [ble, tools] = await Promise.all([fetchBleDevices(companyId), fetchEquipmentList(companyId)]);
        if (!cancelled) {
          setRtlsBleDevices(ble);
          setRtlsTrackedAssets(tools);
        }
      } catch {
        if (!cancelled) {
          setRtlsBleDevices([]);
          setRtlsTrackedAssets([]);
        }
      } finally {
        if (!cancelled) setRtlsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, isSystemAdmin]);

  const rtlsMatch = useMemo(() => {
    if (!data) {
      return { linkedTags: [] as BleDeviceOut[], nameMatchedTracked: null as EquipmentOut | null };
    }
    const key = data.name.trim().toLowerCase();
    const matchingTools = rtlsTrackedAssets.filter((t) => t.name.trim().toLowerCase() === key);
    const toolIds = new Set(matchingTools.map((t) => t.id));
    const linkedTags = rtlsBleDevices.filter(
      (b) => b.type === "equipment_tag" && b.assigned_equipment_id != null && toolIds.has(b.assigned_equipment_id),
    );
    const nameMatchedTracked = matchingTools[0] ?? null;
    return { linkedTags, nameMatchedTracked };
  }, [data, rtlsBleDevices, rtlsTrackedAssets]);

  const equipPhoto = useResolvedProtectedAssetSrc(data?.image_url ?? null);
  const hasPhotoPath = Boolean(data?.image_url?.trim());

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-pulse-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="text-sm">Loading equipment…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Equipment" description="Asset details" icon={Wrench} />
        <Card padding="md">
          <p className="text-sm text-red-700">{error ?? "Not found."}</p>
          <Link
            href="/equipment"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2B4C7E] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to equipment
          </Link>
        </Card>
      </div>
    );
  }

  const subtitle = [data.type, data.zone_name ?? "Unassigned zone"].filter(Boolean).join(" · ");
  const partsOverdue = (data.parts_overdue_count ?? 0) > 0;
  const partsDueSoonOnly = !partsOverdue && (data.parts_due_soon_count ?? 0) > 0;
  const showPartsBanner = partsOverdue || partsDueSoonOnly || Boolean(data.parts_needs_maintenance);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={data.name} description={subtitle} icon={Wrench} />
        <Link
          href="/equipment"
          className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-pulse-navy shadow-sm transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All equipment
        </Link>
      </div>

      {showPartsBanner && partsOverdue ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-sm"
          role="alert"
        >
          <strong className="font-semibold">This equipment requires immediate maintenance.</strong> At least one part is
          overdue for replacement. Review the parts list, mark replacements when done, or open a work order.
        </div>
      ) : null}
      {showPartsBanner && partsDueSoonOnly ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="status"
        >
          <strong className="font-semibold">This equipment has upcoming maintenance.</strong> One or more parts are due
          soon. Plan replacement or create a work request before they become overdue.
        </div>
      ) : null}
      {showPartsBanner && !partsOverdue && !partsDueSoonOnly && data.parts_needs_maintenance ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="status"
        >
          <strong className="font-semibold">Parts require attention.</strong> Review the parts list and open a work request
          when ready.
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className={LABEL}>Photo</h2>
        <Card padding="md" className="flex flex-wrap items-center gap-4">
          {equipPhoto.src ? (
            /* eslint-disable-next-line @next/next/no-img-element -- blob or absolute URL from hook */
            <img src={equipPhoto.src} alt="" className="h-32 w-32 rounded-md object-cover ring-1 ring-slate-200/80" />
          ) : hasPhotoPath && equipPhoto.loading ? (
            <div className="flex h-32 w-32 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs text-pulse-muted">
              Loading photo…
            </div>
          ) : hasPhotoPath && equipPhoto.failed ? (
            <div className="flex h-32 w-32 items-center justify-center rounded-md border border-amber-100 bg-amber-50/80 px-2 text-center text-xs text-amber-900">
              Could not load photo. Try uploading again.
            </div>
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-pulse-muted">
              No photo
            </div>
          )}
          {canMutate ? (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm hover:bg-slate-50">
              <Camera className="h-4 w-4" aria-hidden />
              {uploadingImage ? "Uploading…" : "Add / replace photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                capture="environment"
                className="sr-only"
                disabled={uploadingImage}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setUploadingImage(true);
                  setError(null);
                  try {
                    await uploadEquipmentImage(equipmentId, f);
                    await load();
                  } catch {
                    setError("Image upload failed.");
                  } finally {
                    setUploadingImage(false);
                  }
                }}
              />
            </label>
          ) : null}
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className={LABEL}>Overview</h2>
        <Card padding="md" className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className={LABEL}>Name</p>
            <p className="mt-1 text-sm font-medium text-pulse-navy">{data.name}</p>
          </div>
          <div>
            <p className={LABEL}>Type</p>
            <p className="mt-1 text-sm text-pulse-navy">{data.type}</p>
          </div>
          <div>
            <p className={LABEL}>Zone</p>
            <p className="mt-1 text-sm text-pulse-navy">{data.zone_name ?? "—"}</p>
          </div>
          <div>
            <p className={LABEL}>Status</p>
            <p className="mt-1.5">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadge(data.status)}`}
              >
                {data.status}
              </span>
            </p>
          </div>
          <div>
            <p className={LABEL}>Manufacturer</p>
            <p className="mt-1 text-sm text-pulse-navy">{data.manufacturer ?? "—"}</p>
          </div>
          <div>
            <p className={LABEL}>Model</p>
            <p className="mt-1 text-sm text-pulse-navy">{data.model ?? "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className={LABEL}>Serial</p>
            <p className="mt-1 text-sm text-pulse-navy tabular-nums">{data.serial_number ?? "—"}</p>
          </div>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className={`${LABEL} inline-flex items-center gap-2`}>
          <Bluetooth className="h-3.5 w-3.5" aria-hidden />
          BLE tracking
        </h2>
        <Card padding="md" className="space-y-3">
          <p className="text-sm text-pulse-muted">
            Location tags are managed in{" "}
            <Link href="/devices" className="ds-link font-semibold">
              Zones &amp; Devices
            </Link>
            . When a <span className="font-medium text-pulse-navy">tracked asset</span> uses the same name as this facility
            item, linked equipment tags show below.
          </p>
          {rtlsLoading ? (
            <p className="text-sm text-pulse-muted">Loading tag data…</p>
          ) : rtlsMatch.linkedTags.length > 0 ? (
            <ul className="space-y-2">
              {rtlsMatch.linkedTags.map((b) => (
                <li
                  key={b.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-sm dark:border-ds-border dark:bg-ds-primary/95"
                >
                  <span className="font-medium text-pulse-navy dark:text-gray-100">{b.name}</span>
                  <span className="mt-0.5 block font-mono text-xs text-pulse-muted">{b.mac_address}</span>
                  {rtlsMatch.nameMatchedTracked ? (
                    <span className="mt-1 block text-xs text-pulse-muted">
                      Tracked asset: {rtlsMatch.nameMatchedTracked.name}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : rtlsMatch.nameMatchedTracked ? (
            <p className="text-sm text-pulse-muted">
              Tracked asset{" "}
              <span className="font-medium text-pulse-navy">{rtlsMatch.nameMatchedTracked.name}</span> exists, but no
              equipment tag is assigned to it yet. Open Zones &amp; Devices to link a tag.
            </p>
          ) : (
            <p className="text-sm text-pulse-muted">
              No tracked asset found with the same name as this item. When you assign an equipment tag, create or pick a
              tracked asset named <span className="font-medium text-pulse-navy">{data.name}</span> to align RTLS with this
              record.
            </p>
          )}
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className={LABEL}>Dates</h2>
        <Card padding="md" className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className={LABEL}>Installation</p>
            <p className="mt-1 text-sm text-pulse-navy tabular-nums">{formatDate(data.installation_date)}</p>
          </div>
          <div>
            <p className={LABEL}>Last service</p>
            <p className="mt-1 text-sm text-pulse-navy tabular-nums">{formatDate(data.last_service_date)}</p>
          </div>
          <div>
            <p className={LABEL}>Next service</p>
            <p className="mt-1 text-sm text-pulse-navy tabular-nums">{formatDate(data.next_service_date)}</p>
          </div>
          {data.service_interval_days != null ? (
            <div className="sm:col-span-3">
              <p className={LABEL}>Service interval</p>
              <p className="mt-1 text-sm text-pulse-navy">
                Every {data.service_interval_days} day{data.service_interval_days === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className={LABEL}>Notes</h2>
        <Card padding="md">
          <p className="whitespace-pre-wrap text-sm text-pulse-navy">{data.notes?.trim() ? data.notes : "—"}</p>
        </Card>
      </section>

      <EquipmentPartsPanel
        equipmentId={equipmentId}
        equipmentName={data.name}
        canMutate={canMutate}
        onPartsChanged={() => {
          setMaintenanceHistoryRevision((n) => n + 1);
          void load();
        }}
      />

      {assetMod.settings.enableMaintenanceHistory ? (
        <MaintenanceHistorySection
          equipmentId={equipmentId}
          workOrders={data.related_work_orders}
          revision={maintenanceHistoryRevision}
        />
      ) : null}

      <section className="space-y-2">
        <h2 className={`${LABEL} inline-flex items-center gap-2`}>
          <ClipboardList className="h-3.5 w-3.5" aria-hidden />
          Related work orders
        </h2>
        <Card padding="md" className="!p-0 overflow-hidden">
          {data.related_work_orders.length === 0 ? (
            <p className="p-4 text-sm text-pulse-muted">No work orders linked to this equipment yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.related_work_orders.map((wo) => (
                <li key={wo.id} className="px-4 py-3">
                  <Link
                    href={`/dashboard/maintenance/work-requests?wr=${encodeURIComponent(wo.id)}`}
                    className="group block hover:bg-slate-50/80"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-pulse-navy group-hover:text-[#2B4C7E]">{wo.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${woStatusBadge(wo.status)}`}
                      >
                        {wo.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-pulse-muted">Updated {formatDate(wo.updated_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
