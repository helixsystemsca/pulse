"use client";

import Link from "next/link";
import { useState } from "react";
import { Wrench } from "lucide-react";
import {
  createCorrectiveAction,
  type InspectionItem,
  type InspectionRun,
} from "@/lib/inspectionsService";
import { parseClientApiError } from "@/lib/parse-client-api-error";

export function InspectionCorrectivePanel({
  run,
  onUpdated,
}: {
  run: InspectionRun;
  onUpdated?: (next: InspectionRun) => void;
}) {
  const failed = run.items.filter((i) => i.failed);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hrefByItem, setHrefByItem] = useState<Record<string, string>>({});

  if (!failed.length && run.overall_result !== "fail") return null;

  async function createFor(item: InspectionItem) {
    setBusyId(item.id);
    setError(null);
    try {
      const res = await createCorrectiveAction(run.id, item.id);
      onUpdated?.(res.inspection);
      setHrefByItem((prev) => ({ ...prev, [item.id]: res.href }));
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusyId(null);
    }
  }

  const rows = failed.length ? failed : run.items;

  return (
    <div className="rounded-xl border border-amber-300/80 bg-amber-50 p-4 text-sm text-amber-950">
      <h3 className="flex items-center gap-2 font-semibold">
        <Wrench className="h-4 w-4" aria-hidden />
        Failed inspection — corrective action
      </h3>
      <p className="mt-1 text-xs">
        One-click work request linked to this inspection
        {run.equipment_id ? ", the asset" : ""}
        {run.facility_id ? ", and the facility" : ""}. Notes and photo filenames are copied onto the request.
      </p>
      {error ? <p className="mt-2 text-rose-700">{error}</p> : null}
      <ul className="mt-3 space-y-2">
        {rows.map((item) => {
          const linked = item.work_request_id || hrefByItem[item.id];
          return (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2">
              <span>
                {item.title}
                {item.failed ? <span className="ml-2 text-[10px] font-bold uppercase text-rose-700">fail</span> : null}
              </span>
              {linked ? (
                <Link href={hrefByItem[item.id] || "/dashboard/maintenance"} className="text-xs font-semibold text-[#2B4C7E] hover:underline">
                  Open work request
                </Link>
              ) : (
                <button
                  type="button"
                  className="rounded-lg bg-[#2B4C7E] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  disabled={busyId === item.id}
                  onClick={() => void createFor(item)}
                >
                  {busyId === item.id ? "Creating…" : "Create work request"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
