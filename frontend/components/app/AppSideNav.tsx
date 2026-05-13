"use client";

/**
 * Tenant / system left rail: fixed-height rows, hover-expands width for labels.
 * Rows use a modest height (not aspect-square) so expanding the rail does not blow up tile scale.
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
import { useEffect, useRef, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import type { PulseAuthSession } from "@/lib/pulse-session";
import {
  pulseSystemSidebarNav,
  pulseTenantSidebarNav,
  type PulseSidebarIcon,
} from "@/lib/pulse-app";

type SidebarNavItem = { href: string; label: string; icon: PulseSidebarIcon };
import { defaultWorkspaceHubHref, LEGACY_SIDEBAR_DEPARTMENT_HUB } from "@/config/platform/navigation";
import { isPulseNavActive } from "@/lib/pulse-nav-active";
import { isTenantNavFeatureEnabled } from "@/lib/pulse-nav-features";
import { isTenantNavPermissionGranted } from "@/lib/pulse-nav-permissions";
import { sessionHasAnyRole, sessionPrimaryRole } from "@/lib/pulse-roles";
import { cn } from "@/lib/cn";
import { isPlatformDepartmentPath } from "@/lib/platform/path-detection";
import { PlatformAppSideNav } from "@/components/platform/PlatformAppSideNav";

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

/** Icon column: keep in sync with the navbar logo square width. */
const COLLAPSED_RAIL_W = "w-[var(--pulse-sidebar-collapsed-width)]";
const ICON_COL = `h-11 ${COLLAPSED_RAIL_W} shrink-0`;

/** Row highlight: identical hover + active — primary accent ({@link --ds-accent}, ice blue). */
const SIDENAV_ROW_ACTIVE_HOVER = "bg-[var(--ds-accent)]";
const SIDENAV_ROW_ACTIVE_HOVER_HOVER = "hover:bg-[var(--ds-accent)]";

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
  const asideRef = useRef<HTMLElement | null>(null);

  /** Clicks leave focus on the `<Link>`; `focus-within` used to widen the rail and matched inconsistently across routes. Collapse and blur after navigation. */
  useEffect(() => {
    setRailExpanded(false);
    const root = asideRef.current;
    if (!root) return;
    const ae = document.activeElement;
    if (ae instanceof HTMLElement && root.contains(ae)) {
      ae.blur();
    }
  }, [pathname]);

  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const rawNav = isSystemAdmin ? pulseSystemSidebarNav : pulseTenantSidebarNav;
  let items: SidebarNavItem[] = (
    !isSystemAdmin && sessionPrimaryRole(session) === "worker"
      ? rawNav.filter((i) => i.href !== "/monitoring")
      : [...rawNav]
  ).map((i) => ({ href: i.href, label: i.label, icon: i.icon }));
  if (!isSystemAdmin) {
    items = [
      ...items,
      {
        href: defaultWorkspaceHubHref(session),
        label: LEGACY_SIDEBAR_DEPARTMENT_HUB.label,
        icon: LEGACY_SIDEBAR_DEPARTMENT_HUB.icon as PulseSidebarIcon,
      },
    ];
  }
  if (!isSystemAdmin && session) {
    if (session.role !== "demo_viewer") {
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

  if (isPlatformDepartmentPath(pathname)) {
    return <PlatformAppSideNav />;
  }

  const labelVisibility = cn(
    "min-w-0 truncate text-left text-[13px] font-semibold transition-[opacity,max-width,margin] duration-300 ease-in-out motion-reduce:transition-none",
    railExpanded ? "max-w-[200px] opacity-100" : "max-w-0 opacity-0",
    "group-focus-within/sidenav:max-w-[200px] group-focus-within/sidenav:opacity-100",
  );

  return (
    <aside
      ref={asideRef}
      onMouseEnter={() => setRailExpanded(true)}
      onMouseLeave={() => setRailExpanded(false)}
      className={cn(
        "group/sidenav hidden lg:flex fixed left-0 z-[40] flex-col overflow-x-hidden overflow-y-auto rounded-none border-r border-ds-border bg-ds-primary",
        "top-[var(--pulse-header-height)] h-[calc(100vh-var(--pulse-header-height))]",
        "shadow-[var(--ds-shadow-card)] motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-in-out",
        railExpanded ? "w-[var(--pulse-sidebar-expanded-width)]" : COLLAPSED_RAIL_W,
      )}
      aria-label={systemRail ? "System navigation" : "App navigation"}
    >
      <nav
        className="flex min-h-0 flex-1 flex-col border-t border-ds-border bg-ds-primary"
        aria-label="Navigation"
      >
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
                "group/nav box-border flex min-h-11 h-11 w-full shrink-0 items-stretch rounded-none border-0 outline-none transition-colors duration-200 ease-out motion-reduce:transition-none",
                active ? SIDENAV_ROW_ACTIVE_HOVER : cn("bg-transparent", SIDENAV_ROW_ACTIVE_HOVER_HOVER),
                "focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring)] focus-visible:ring-offset-0",
              )}
            >
              <span
                className={cn(
                  ICON_COL,
                  "flex items-center justify-center text-[var(--ds-text-primary)]",
                  active ? "text-white" : "group-hover/nav:text-white",
                )}
              >
                <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={2} aria-hidden />
              </span>
              <span
                className={cn(
                  labelVisibility,
                  "flex min-w-0 flex-1 items-center pr-3 text-[var(--ds-text-primary)]",
                  active ? "text-white" : "group-hover/nav:text-white",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
