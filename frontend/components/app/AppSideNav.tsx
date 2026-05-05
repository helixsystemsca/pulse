"use client";

/**
 * Tenant / system left rail: grouped nav, full-height shell.
 * Hover- or focus-within-expands (64px → 220px) over main content; no toggle UI here.
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

/** Square icon control: token border/radius; hover/active fill uses brand accent + accent-foreground. */
function navItemSquareClasses(active: boolean) {
  return cn(
    "flex size-10 shrink-0 items-center justify-center rounded-[10px] border transition-[background-color,border-color,color] duration-200 ease-out motion-reduce:transition-none",
    "border-ds-sidebar-border",
    active
      ? "border-transparent bg-ds-accent text-ds-accent-foreground"
      : "bg-transparent text-ds-sidebar-fg group-hover/nav:border-transparent group-hover/nav:bg-ds-accent group-hover/nav:text-ds-accent-foreground",
  );
}

const labelShowClasses =
  "max-w-0 opacity-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-out motion-reduce:transition-none group-hover/sidenav:max-w-[200px] group-hover/sidenav:opacity-100 group-focus-within/sidenav:max-w-[200px] group-focus-within/sidenav:opacity-100";

export function AppSideNav() {
  const pathname = usePathname();
  const { authed, session } = usePulseAuth();

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

  return (
    <div className="relative z-20 hidden h-full w-16 shrink-0 overflow-visible lg:block">
      <aside
        className={cn(
          "group/sidenav absolute left-0 top-0 z-30 flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto border-r border-ds-sidebar-border bg-ds-sidebar",
          "w-16 shadow-[2px_0_12px_rgba(0,0,0,0.06)] transition-[width,box-shadow] duration-300 ease-out motion-reduce:transition-none",
          "hover:w-[220px] hover:shadow-[4px_0_20px_rgba(0,0,0,0.1)] focus-within:w-[220px] focus-within:shadow-[4px_0_20px_rgba(0,0,0,0.1)]",
          "dark:shadow-[2px_0_16px_rgba(0,0,0,0.22)] dark:hover:shadow-[4px_0_24px_rgba(0,0,0,0.35)] dark:focus-within:shadow-[4px_0_24px_rgba(0,0,0,0.35)]",
        )}
        aria-label={systemRail ? "System navigation" : "App navigation"}
      >
        <nav className="flex min-h-0 flex-1 flex-col gap-2 px-2 py-3" aria-label="Navigation">
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
                  "group/nav flex min-w-0 items-center gap-2 rounded-[10px] py-0.5 outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ds-sidebar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-sidebar",
                )}
              >
                <span className={navItemSquareClasses(active)}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-ds-sidebar-fg", labelShowClasses)}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto shrink-0 space-y-2 border-t border-ds-sidebar-border px-2 py-3">
          {canOpenOrgSettings ? (
            <Link
              href="/settings"
              title="Settings"
              className={cn(
                "group/nav flex min-w-0 items-center gap-2 rounded-[10px] py-0.5 outline-none",
                "focus-visible:ring-2 focus-visible:ring-ds-sidebar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-sidebar",
              )}
            >
              <span className={navItemSquareClasses(settingsActive)}>
                <Settings className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </span>
              <span className={cn("min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-ds-sidebar-fg", labelShowClasses)}>
                Settings
              </span>
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
    </div>
  );
}
