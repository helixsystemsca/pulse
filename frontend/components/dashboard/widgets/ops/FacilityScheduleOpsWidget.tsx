"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange } from "lucide-react";

import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import { opsWidgetFillLayout } from "@/lib/dashboard/ops-widget-fill";
import { cn } from "@/lib/cn";

const BC_TZ = "America/Vancouver";

export type FacilityScheduleEvent = {
  id: string;
  program_name: string;
  start_time: string;
  end_time: string;
  location: string;
  staff: string[];
  status?: string | null;
};

function formatTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso).toLocaleTimeString(undefined, {
    timeZone: BC_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  const e = new Date(endIso).toLocaleTimeString(undefined, {
    timeZone: BC_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${s}–${e}`;
}

/** YYYY-MM-DD in facility TZ */
function ymdInBc(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function eventStartsToday(ev: FacilityScheduleEvent, todayYmd: string): boolean {
  try {
    const start = new Date(ev.start_time);
    if (Number.isNaN(start.getTime())) return true;
    return ymdInBc(start) === todayYmd;
  } catch {
    return true;
  }
}

export function useFacilityScheduleEvents() {
  const [events, setEvents] = useState<FacilityScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const supportedRef = useRef(true);

  const load = useCallback(async () => {
    if (!supportedRef.current) return;
    try {
      const res = await fetch("/api/schedule", { cache: "no-store" });
      if (res.status === 404) {
        supportedRef.current = false;
        setEvents([]);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("schedule_fetch_failed");
      const data = (await res.json()) as FacilityScheduleEvent[];
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(load, 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  return { events, loading, apiUnsupported: !supportedRef.current && !loading };
}

function FacilityScheduleInner({
  compact,
  maxLocations,
  maxPerLocation,
  showFooterLinks = true,
  fillShell = false,
}: {
  compact?: boolean;
  maxLocations?: number;
  maxPerLocation?: number;
  /** When false (ops dashboard tile), navigation uses the shell jump icon only. */
  showFooterLinks?: boolean;
  /** Stretch content to fill ops widget shell height (expanded / tall tiers). */
  fillShell?: boolean;
}) {
  const { events, loading, apiUnsupported } = useFacilityScheduleEvents();
  const todayYmd = useMemo(() => ymdInBc(new Date()), []);

  const grouped = useMemo(() => {
    const todayEv = events.filter((ev) => eventStartsToday(ev, todayYmd));
    const bucket = todayEv.reduce<Record<string, FacilityScheduleEvent[]>>((acc, ev) => {
      const loc = ev.location?.trim() || "Facility";
      (acc[loc] ||= []).push(ev);
      return acc;
    }, {});
    const locCap = maxLocations ?? (compact ? 2 : 6);
    const perCap = maxPerLocation ?? (compact ? 3 : 8);
    return Object.entries(bucket)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, locCap)
      .map(([loc, list]) => [
        loc,
        list.slice().sort((a, b) => a.start_time.localeCompare(b.start_time)).slice(0, perCap),
      ] as const);
  }, [events, todayYmd, compact, maxLocations, maxPerLocation]);

  const mutedText = "text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]";
  const fillCenter = fillShell ? "flex flex-1 items-center justify-center text-center" : "";

  if (loading) {
    return (
      <p className={cn("text-xs", mutedText, fillCenter, fillShell && "min-h-0 px-2")}>Loading schedule…</p>
    );
  }

  if (apiUnsupported) {
    return (
      <div className={cn(fillShell && "flex min-h-0 flex-1 flex-col")}>
        <p
          className={cn(
            "text-xs leading-snug text-[color-mix(in_srgb,var(--ds-text-primary)_62%,transparent)]",
            fillCenter,
            fillShell && "flex-1 px-2",
          )}
        >
          Facility schedule feed is not configured for this environment. Use the header icon to open Schedule and manage
          shifts and programs.
        </p>
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div
        className={cn(
          fillShell &&
            "flex min-h-0 flex-1 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--ds-text-primary)_4%,transparent)] px-3",
        )}
      >
        <p className={cn("text-xs", mutedText, fillShell ? "text-sm leading-snug" : "")}>
          No program blocks on the roster for today.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(fillShell ? "flex h-full min-h-0 flex-col" : "space-y-3")}>
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]",
          fillShell ? "py-1 text-[11px]" : "text-[11px]",
        )}
      >
        <CalendarRange className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        <span>Today&apos;s program blocks</span>
      </div>
      <div
        className={cn(
          fillShell ? "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5" : "space-y-3",
          fillShell && grouped.length > 1 && "justify-between",
        )}
      >
        {grouped.map(([loc, list]) => (
          <div key={loc} className={cn(fillShell && grouped.length > 1 && "min-h-0 flex-1", "space-y-1.5")}>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
              {loc}
            </p>
            <ul className={cn(fillShell && list.length > 1 ? "flex h-full min-h-0 flex-col justify-between gap-1.5" : "space-y-1.5")}>
              {list.map((ev) => (
                <li
                  key={ev.id}
                  className={cn(
                    "ops-dash-row flex items-start justify-between gap-2 px-2",
                    compact ? "py-1" : fillShell ? "flex-1 py-2" : "py-1.5",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]",
                        fillShell ? "text-sm" : "text-xs",
                      )}
                    >
                      {ev.program_name}
                    </p>
                    {ev.staff?.length ? (
                      <p className="mt-0.5 truncate text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
                        {ev.staff.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
                    {formatTimeRange(ev.start_time, ev.end_time)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {showFooterLinks && !compact ? (
        <Link
          href="/schedule"
          className="inline-block shrink-0 text-[11px] font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline"
        >
          Full schedule →
        </Link>
      ) : null}
    </div>
  );
}

/** Built-in operations tile body (wrapped by `OpsWidgetShell` in `OperationalDashboard`). */
export function FacilityScheduleOpsWidget({
  layoutContext,
}: {
  layoutContext?: DashboardWidgetRenderContext | null;
}) {
  const fillShell = opsWidgetFillLayout(layoutContext?.heightTier);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="ops-dash-inner-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <FacilityScheduleInner
          showFooterLinks={false}
          fillShell={fillShell}
          maxLocations={fillShell ? 6 : 4}
          maxPerLocation={fillShell ? 10 : 6}
        />
      </div>
    </div>
  );
}

/** Custom peek widget slice: reuses the same `/api/schedule` feed. */
export function FacilitySchedulePeekSlice({ compact, dense }: { compact: boolean; dense: boolean }) {
  return (
    <FacilityScheduleInner
      compact={compact || dense}
      maxLocations={compact ? 2 : dense ? 4 : 5}
      maxPerLocation={compact ? 2 : dense ? 5 : 8}
    />
  );
}
