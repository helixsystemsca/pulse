"use client";

/**
 * Collapsible icon rail: tenant links (dashboard, compliance, schedule, marketing anchors) or,
 * on `/system/*`, system-admin links. Expands on hover (desktop) or tap (mobile).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  Layers,
  LayoutDashboard,
  MapPin,
  Package,
  ScrollText,
  UserCog,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseSystemSidebarNav, pulseTenantSidebarNav, type PulseSidebarIcon } from "@/lib/pulse-app";
import { isPulseNavActive } from "@/lib/pulse-nav-active";
import { isTenantNavFeatureEnabled } from "@/lib/pulse-nav-features";
import { isTenantNavPermissionGranted } from "@/lib/pulse-nav-permissions";
import { managerOrAbove, sessionPrimaryRole } from "@/lib/pulse-roles";

/** First word on line 1, remaining words on line 2 — fits narrow expanded rail. */
function splitNavLabel(label: string): { line1: string; line2: string | null } {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { line1: label.trim(), line2: null };
  return { line1: parts[0]!, line2: parts.slice(1).join(" ") };
}

const ICONS: Record<PulseSidebarIcon, LucideIcon> = {
  layout: LayoutDashboard,
  activity: Activity,
  calendar: CalendarDays,
  "folder-kanban": FolderKanban,
  clipboard: ClipboardList,
  package: Package,
  wrench: Wrench,
  "map-pin": MapPin,
  layers: Layers,
  building: Building2,
  "user-cog": UserCog,
  "scroll-text": ScrollText,
};

export function AppSideNav() {
  const pathname = usePathname();
  const { authed, session } = usePulseAuth();
  const [narrowExpanded, setNarrowExpanded] = useState(false);

  useEffect(() => {
    setNarrowExpanded(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setNarrowExpanded(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!authed) return null;

  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  /** Platform shell: always use the slim system rail (not tenant product links). Imp JWTs look like tenant users. */
  const rawNav = isSystemAdmin ? pulseSystemSidebarNav : pulseTenantSidebarNav;
  let items =
    !isSystemAdmin && sessionPrimaryRole(session) === "worker"
      ? rawNav.filter((i) => i.href !== "/monitoring")
      : [...rawNav];
  if (!isSystemAdmin && session) {
    items = items.filter((i) => isTenantNavFeatureEnabled(i.href, session.enabled_features));
    items = items.filter((i) => {
      if (i.href === "/dashboard/workers" || i.href.startsWith("/dashboard/workers")) {
        if (session.workers_roster_access === false) return false;
        if (!isTenantNavPermissionGranted(i.href, session.permissions)) return false;
        if (session.workers_roster_access === true) return true;
        return managerOrAbove(session);
      }
      return isTenantNavPermissionGranted(i.href, session.permissions);
    });
  }
  const systemRail = isSystemAdmin;

  const tenantShell =
    "border border-ds-border bg-ds-sidebar shadow-[var(--ds-shadow-card)] backdrop-blur-md lg:hover:shadow-[var(--ds-shadow-card-hover)]";

  const tenantShellMobilePop = "max-lg:shadow-[var(--ds-shadow-card-hover)]";

  return (
    <>
      {narrowExpanded ? (
        <button
          type="button"
          className="fixed inset-0 z-[35] bg-[color-mix(in_srgb,var(--ds-text-primary)_18%,transparent)] backdrop-blur-[1px] dark:bg-[color-mix(in_srgb,var(--ds-surface-elevated)_52%,var(--ds-bg)_48%)]"
          aria-label="Close menu"
          onClick={() => setNarrowExpanded(false)}
        />
      ) : null}

      <aside
        className={`group/sidebar fixed left-3 top-1/2 z-[40] flex max-h-[min(85vh,52rem)] w-[4.25rem] -translate-y-1/2 flex-col overflow-hidden overflow-y-auto rounded-md border transition-[width,box-shadow] duration-200 ease-out lg:hover:w-[11.5rem] ${tenantShell} ${narrowExpanded ? tenantShellMobilePop : ""}`}
        aria-label="App"
      >
        <nav className="flex flex-col gap-0.5 px-1 py-2">
          {items.map((item) => {
            const active = isPulseNavActive(item.href, pathname);
            const Icon = ICONS[item.icon];
            const { line1, line2 } = splitNavLabel(item.label);
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                title={item.label}
                onClick={() => setNarrowExpanded(false)}
                className={`relative flex min-h-[2.375rem] items-center gap-2 rounded-lg border-l-2 py-1 pl-0.5 pr-1 text-xs font-semibold leading-tight transition-[color,background-color,box-shadow,border-color] ${
                  active
                    ? "border-l-ds-success bg-[color-mix(in_srgb,var(--ds-success)_14%,var(--ds-sidebar))] text-ds-foreground shadow-[0_0_12px_color-mix(in_srgb,var(--ds-success)_22%,transparent)]"
                    : "border-l-transparent text-ds-muted hover:bg-[color-mix(in_srgb,var(--ds-success)_10%,var(--ds-sidebar))] hover:text-ds-foreground"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    active
                      ? "bg-ds-primary text-ds-success shadow-sm ring-1 ring-[color-mix(in_srgb,var(--ds-success)_35%,transparent)]"
                      : "bg-ds-secondary text-ds-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                <span
                  className={`min-w-0 flex-1 overflow-hidden text-left transition-[max-width,opacity] duration-200 ease-out lg:max-w-0 lg:opacity-0 lg:group-hover/sidebar:max-w-[9.25rem] lg:group-hover/sidebar:opacity-100 ${
                    narrowExpanded ? "max-w-[9.25rem] opacity-100" : "max-w-0 opacity-0"
                  }`}
                >
                  <span className="block truncate">{line1}</span>
                  {line2 ? <span className="mt-0.5 block truncate opacity-90">{line2}</span> : null}
                </span>
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="flex shrink-0 items-center justify-center border-t border-ds-border py-1.5 lg:hidden"
          onClick={() => setNarrowExpanded((o) => !o)}
          aria-expanded={narrowExpanded}
          aria-label={narrowExpanded ? "Collapse navigation" : "Expand navigation"}
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform text-ds-muted ${narrowExpanded ? "rotate-180" : ""}`}
            strokeWidth={2}
            aria-hidden
          />
        </button>
      </aside>
    </>
  );
}
