"use client";

import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PreventativeMaintenanceApp } from "@/components/maintenance/PreventativeMaintenanceApp";
import { WorkRequestsApp } from "@/components/work-requests/WorkRequestsApp";

const HUB_CATS = [
  { id: "", label: "All" },
  { id: "preventative", label: "Preventative" },
  { id: "work_requests", label: "Work requests" },
  { id: "projects", label: "Projects" },
] as const;

const STATUS_IDS = [
  { id: "", label: "All statuses" },
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "hold", label: "Hold" },
  { id: "completed", label: "Complete" },
  { id: "cancelled", label: "Cancelled" },
  { id: "overdue", label: "Overdue" },
] as const;

function chipClass(active: boolean) {
  return active
    ? "border-ds-accent bg-ds-accent/15 text-ds-foreground ring-1 ring-ds-accent/30"
    : "border-ds-border bg-ds-secondary/60 text-ds-muted hover:border-ds-border hover:bg-ds-interactive-hover hover:text-ds-foreground";
}

export function MaintenanceWorkHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hub = searchParams.get("hub") ?? "";
  const status = searchParams.get("status") ?? "";

  const pushFilters = (next: { hub?: string; status?: string }) => {
    const sp = new URLSearchParams(searchParams.toString());
    const nh = next.hub !== undefined ? next.hub : hub;
    const ns = next.status !== undefined ? next.status : status;
    if (nh) sp.set("hub", nh);
    else sp.delete("hub");
    if (ns) sp.set("status", ns);
    else sp.delete("status");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-8">
      <div className="rounded-md border border-ds-border bg-ds-primary p-4 shadow-[var(--ds-shadow-card)] md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-ds-foreground">
            <ClipboardList className="h-5 w-5 text-ds-muted" aria-hidden />
            <h2 className="text-sm font-semibold">Work request hub</h2>
          </div>
          <Link href="/dashboard/procedures" className="text-sm font-semibold text-ds-accent hover:underline">
            Procedure library →
          </Link>
        </div>
        <p className="mt-2 text-xs text-ds-muted md:text-sm">
          Filter by work source. Status filters use the same request IDs as elsewhere (open, in_progress, hold,
          completed, cancelled, overdue).
        </p>
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Category</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {HUB_CATS.map((c) => (
              <button
                key={c.id || "all"}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${chipClass(hub === c.id)}`}
                onClick={() => pushFilters({ hub: c.id })}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Status ID</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUS_IDS.map((s) => (
              <button
                key={s.id || "all-st"}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${chipClass(status === s.id)}`}
                onClick={() => pushFilters({ status: s.id })}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex min-h-[12rem] items-center justify-center rounded-md border border-ds-border bg-ds-secondary p-8 text-ds-muted">
            <p className="text-sm text-pulse-muted">Loading work requests…</p>
          </div>
        }
      >
        <WorkRequestsApp hubMode initialHubCategory={hub} initialStatusFilter={status} />
      </Suspense>

      <details className="group rounded-md border border-ds-border bg-ds-primary shadow-[var(--ds-shadow-card)]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ds-foreground marker:content-none md:px-5 md:py-4 [&::-webkit-details-marker]:hidden">
          <span className="text-ds-muted group-open:hidden">Preventative scheduling (rules)</span>
          <span className="hidden text-ds-muted group-open:inline">Preventative scheduling — hide</span>
        </summary>
        <div className="border-t border-ds-border px-4 py-4 md:px-5 md:pb-6">
          <PreventativeMaintenanceApp />
        </div>
      </details>
    </div>
  );
}
