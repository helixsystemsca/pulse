"use client";

import { ArrowLeft, Camera, ClipboardList, Loader2, Wrench } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EquipmentPartsPanel } from "@/components/equipment/EquipmentPartsPanel";
import { Card } from "@/components/pulse/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import {
  fetchEquipment,
  resolveEquipmentAssetUrl,
  uploadEquipmentImage,
  type FacilityEquipmentDetail,
} from "@/lib/equipmentService";

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

function managerOrAbove(role: string | undefined, isSys: boolean | undefined): boolean {
  if (isSys || role === "system_admin") return true;
  return role === "manager" || role === "company_admin";
}

export function EquipmentDetailApp({ equipmentId }: Props) {
  const { session } = usePulseAuth();
  const canMutate = managerOrAbove(session?.role, session?.is_system_admin);

  const [data, setData] = useState<FacilityEquipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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
  const equipImg = resolveEquipmentAssetUrl(data.image_url);

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

      {data.parts_needs_maintenance ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="status"
        >
          <strong className="font-semibold">Parts require attention.</strong> This equipment has parts that are due soon or
          overdue. Review the parts list and open a work request when ready.
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className={LABEL}>Photo</h2>
        <Card padding="md" className="flex flex-wrap items-center gap-4">
          {equipImg ? (
            <img src={equipImg} alt="" className="h-32 w-32 rounded-xl object-cover ring-1 ring-slate-200/80" />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-pulse-muted">
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
        onPartsChanged={() => void load()}
      />

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
                    href={`/dashboard/work-requests?wr=${encodeURIComponent(wo.id)}`}
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
