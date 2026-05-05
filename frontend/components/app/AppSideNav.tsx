"use client";

/**
 * Tenant / system left rail: square tiles, hover-expands (64px → 220px), fixed overlay.
 * Routing and item set unchanged from `pulseTenantSidebarNav` / `pulseSystemSidebarNav`.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Building2,
  CalendarDays,
  ClipboardList,
  FolderKanban,
  Layers,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Package,
  Radio,
  ScrollText,
  Settings,
  Sparkles,
  UserCog,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import type { PulseAuthSession } from "@/lib/pulse-session";
import {
  pulseSystemSidebarNav,
  pulseTenantSidebarNav,
  type PulseSidebarIcon,
} from "@/lib/pulse-app";

type SidebarNavItem = { href: string; label: string; icon: PulseSidebarIcon };
import { isPulseNavActive } from "@/lib/pulse-nav-active";
import { isTenantNavFeatureEnabled } from "@/lib/pulse-nav-features";
import { isTenantNavPermissionGranted } from "@/lib/pulse-nav-permissions";
import {
  canAccessCompanyConfiguration,
  sessionHasAnyRole,
  sessionPrimaryRole,
} from "@/lib/pulse-roles";
import { cn } from "@/lib/cn";

const ICONS: Record<PulseSidebarIcon, LucideIcon> = {
  layout: LayoutDashboard,
  activity: Activity,
  calendar: CalendarDays,
  "folder-kanban": FolderKanban,
  clipboard: ClipboardList,
  "list-checks": ListChecks,
  sparkles: Sparkles,
  package: Package,
  wrench: Wrench,
  "map-pin": MapPin,
  radio: Radio,
  layers: Layers,
  building: Building2,
  "user-cog": UserCog,
  "scroll-text": ScrollText,
  settings: Settings,
};

/** Team Management: tenant feature `team_management` + route permission; roster delegation still grants access. */
function showWorkersNavItem(session: PulseAuthSession, isSystemAdmin: boolean): boolean {
  if (isSystemAdmin) return true;
  if (session.workers_roster_access === true) return true;
  if (session.enabled_features?.includes("team_management")) return true;
  if (session.workers_roster_access === false) return false;
  return sessionHasAnyRole(session, "company_admin");
}

export function AppSideNav() {
  const pathname = usePathname();
  const { authed, session } = usePulseAuth();
  const [railExpanded, setRailExpanded] = useState(false);

  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const isDemoViewer = session?.role === "demo_viewer";
  const canOpenOrgSettings = isSystemAdmin || canAccessCompanyConfiguration(session);
  const rawNav = isSystemAdmin ? pulseSystemSidebarNav : pulseTenantSidebarNav;
  let items: SidebarNavItem[] = (
    !isSystemAdmin && sessionPrimaryRole(session) === "worker"
      ? rawNav.filter((i) => i.href !== "/monitoring")
      : [...rawNav]
  ).map((i) => ({ href: i.href, label: i.label, icon: i.icon }));
  if (!isSystemAdmin && session) {
    if (!isDemoViewer) {
      items = items.filter((i) => isTenantNavFeatureEnabled(i.href, session.enabled_features));
      items = items.filter((i) => {
        if (i.href === "/dashboard/workers" || i.href.startsWith("/dashboard/workers")) {
          if (!showWorkersNavItem(session, isSystemAdmin)) return false;
          if (!isTenantNavPermissionGranted(i.href, session.permissions)) return false;
          return true;
        }
        return isTenantNavPermissionGranted(i.href, session.permissions);
      });
    }
  }
  items = items.filter((i) => i.href !== "/settings");
  const systemRail = isSystemAdmin;

  if (!authed || !session) return null;

  const settingsActive = isPulseNavActive("/settings", pathname);

  const labelVisibility = cn(
    "min-w-0 truncate text-left text-[13px] font-semibold text-ds-sidebar-fg transition-[opacity,max-width] duration-300 ease-in-out motion-reduce:transition-none",
    railExpanded ? "max-w-[200px] opacity-100" : "max-w-0 opacity-0",
    "group-focus-within/sidenav:max-w-[200px] group-focus-within/sidenav:opacity-100",
  );

  const tileGradientActive =
    "linear-gradient(135deg, var(--ds-accent), color-mix(in srgb, var(--ds-accent-dusk) 65%, var(--ds-accent)))";

  return (
    <aside
      onMouseEnter={() => setRailExpanded(true)}
      onMouseLeave={() => setRailExpanded(false)}
      className={cn(
        "group/sidenav hidden lg:flex fixed left-0 z-[70] flex-col overflow-x-hidden overflow-y-auto border-r border-ds-sidebar-border",
        "top-[calc(3.625rem+1px+4px)] sm:top-[calc(3.5rem+1px+4px)] bottom-10",
        "shadow-[var(--ds-shadow-card)] motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-in-out",
        railExpanded ? "w-[220px]" : "w-16",
        "focus-within:w-[220px]",
      )}
      style={{
        background:
          "linear-gradient(180deg, var(--ds-sidebar), color-mix(in srgb, var(--ds-sidebar) 82%, var(--ds-text-primary)))",
      }}
      aria-label={systemRail ? "System navigation" : "App navigation"}
    >
      <nav className="flex min-h-0 flex-1 flex-col gap-1 p-2" aria-label="Navigation">
        {items.map((item) => {
          const active = isPulseNavActive(item.href, pathname);
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              title={item.label}
              data-guided-tour-anchor={item.href === "/dashboard/maintenance" ? "sidebar-work-requests" : undefined}
              className={cn(
                "group/nav relative flex w-full aspect-square min-h-0 items-center overflow-hidden rounded-[10px] border border-ds-sidebar-border outline-none",
                "focus-visible:ring-2 focus-visible:ring-ds-sidebar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-sidebar",
                "[&:focus-visible_.nav-tile-fill]:opacity-100",
                "[&:focus-visible_.nav-icon-wrap]:text-ds-accent-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "nav-tile-fill pointer-events-none absolute inset-0 z-0 rounded-[10px] transition-opacity duration-200 ease-out motion-reduce:transition-none",
                  active ? "opacity-100" : "opacity-0 group-hover/nav:opacity-100",
                )}
                style={{ background: tileGradientActive }}
              />
              <div className="relative z-10 flex h-full w-full min-w-0 items-center gap-2 px-2">
                <span className="nav-icon-wrap flex size-10 shrink-0 items-center justify-center text-ds-sidebar-fg transition-colors duration-200 group-hover/nav:text-ds-accent-foreground">
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] transition-colors duration-200",
                      active && "text-ds-accent-foreground",
                    )}
                    strokeWidth={2}
                    aria-hidden
                  />
                </span>
                <span className={labelVisibility}>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 space-y-1 border-t border-ds-sidebar-border p-2">
        {canOpenOrgSettings ? (
          <Link
            href="/settings"
            title="Settings"
            className={cn(
              "group/nav relative flex w-full aspect-square min-h-0 items-center overflow-hidden rounded-[10px] border border-ds-sidebar-border outline-none",
              "focus-visible:ring-2 focus-visible:ring-ds-sidebar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-sidebar",
              "[&:focus-visible_.nav-tile-fill]:opacity-100",
              "[&:focus-visible_.nav-icon-wrap]:text-ds-accent-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "nav-tile-fill pointer-events-none absolute inset-0 z-0 rounded-[10px] transition-opacity duration-200 ease-out motion-reduce:transition-none",
                settingsActive ? "opacity-100" : "opacity-0 group-hover/nav:opacity-100",
              )}
              style={{ background: tileGradientActive }}
            />
            <div className="relative z-10 flex h-full w-full min-w-0 items-center gap-2 px-2">
              <span className="nav-icon-wrap flex size-10 shrink-0 items-center justify-center text-ds-sidebar-fg transition-colors duration-200 group-hover/nav:text-ds-accent-foreground">
                <Settings
                  className={cn(
                    "h-[18px] w-[18px] transition-colors duration-200",
                    settingsActive && "text-ds-accent-foreground",
                  )}
                  strokeWidth={2}
                  aria-hidden
                />
              </span>
              <span className={labelVisibility}>Settings</span>
            </div>
          </Link>
        ) : null}
        {isDemoViewer ? (
          <div
            className="rounded-[10px] border border-[rgba(255,105,180,0.35)] bg-[linear-gradient(135deg,#ff7aa2_0%,#ff5f87_40%,#ff3d6e_100%)] px-2 py-2 text-xs font-semibold text-white shadow-sm"
            style={{ boxShadow: "0 10px 22px rgba(255, 61, 110, 0.18)" }}
          >
            Demo Mode – View only
          </div>
        ) : null}
      </div>
    </aside>
  );
}
