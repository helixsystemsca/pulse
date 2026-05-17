"use client";

/**
 * Tenant / system left rail: fixed-height rows, hover-expands width for labels.
 * Rows use a modest height (not aspect-square) so expanding the rail does not blow up tile scale.
 *
 * Tenant rail is composed exclusively from {@link TENANT_NAV_MODULES} via `tenantSidebarNavItemsForSession`.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart2,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  MapPin,
  Megaphone,
  MessageSquare,
  Newspaper,
  Package,
  Radio,
  ScrollText,
  Settings,
  Sparkles,
  UserCog,
  Waves,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import type { PlatformIconKey } from "@/config/platform/types";
import { pulseSystemSidebarNav, type PulseSidebarIcon } from "@/lib/pulse-app";
import { isPulseNavActive } from "@/lib/pulse-nav-active";
import { logSidebarResolution } from "@/lib/rbac/debugResolvedAccess";
import { tenantSidebarNavGroupsForLiveApp } from "@/lib/rbac/session-access";
import type { TenantSidebarNavGroup } from "@/lib/rbac/sidebar-groups";
import type { TenantNavIcon } from "@/config/platform/tenant-nav-registry";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = {
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

const PLATFORM_DEPT_ICONS: Record<PlatformIconKey, LucideIcon> = {
  layout: LayoutDashboard,
  wrench: Wrench,
  megaphone: Megaphone,
  waves: Waves,
  dumbbell: Dumbbell,
  building: Building2,
  clipboard: ClipboardList,
  "scroll-text": ScrollText,
  package: Package,
  "book-open": BookOpen,
  "bar-chart-2": BarChart2,
  "message-square": MessageSquare,
  newspaper: Newspaper,
  image: ImageIcon,
  calendar: CalendarDays,
  "layout-grid": LayoutGrid,
  "file-text": FileText,
};

const RAIL_ICONS: Record<string, LucideIcon> = { ...PLATFORM_DEPT_ICONS, ...ICONS };

function railIcon(icon: TenantNavIcon | PulseSidebarIcon | PlatformIconKey): LucideIcon {
  return RAIL_ICONS[icon] ?? LayoutDashboard;
}

const COLLAPSED_RAIL_W = "w-[var(--pulse-sidebar-collapsed-width)]";
const ICON_COL = `h-11 ${COLLAPSED_RAIL_W} shrink-0`;

const SIDENAV_ROW_ACTIVE_HOVER = "bg-[var(--ds-accent)]";
const SIDENAV_ROW_ACTIVE_HOVER_HOVER = "hover:bg-[var(--ds-accent)]";

type SidebarNavItem = { href: string; label: string; icon: TenantNavIcon | PulseSidebarIcon | PlatformIconKey };

const SIDEBAR_COLLAPSE_STORAGE_KEY = "pulse.sidebar.collapsedCategories";

function readCollapsedCategorySet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function persistCollapsedCategories(collapsed: Set<string>) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch {
    /* ignore quota / private mode */
  }
}

export function AppSideNav() {
  const pathname = usePathname();
  const { authed, session } = usePulseAuth();
  const [railExpanded, setRailExpanded] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => new Set());
  const asideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setCollapsedCategories(readCollapsedCategorySet());
  }, []);

  const toggleCategoryCollapsed = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      persistCollapsedCategories(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setRailExpanded(false);
    const root = asideRef.current;
    if (!root) return;
    const ae = document.activeElement;
    if (ae instanceof HTMLElement && root.contains(ae)) {
      ae.blur();
    }
  }, [pathname]);

  useEffect(() => {
    logSidebarResolution(session);
  }, [session]);

  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const navGroups: TenantSidebarNavGroup[] = isSystemAdmin
    ? [
        {
          category: "System",
          items: pulseSystemSidebarNav.map((i) => ({
            key: i.href,
            href: i.href,
            label: i.label,
            icon: i.icon,
          })),
        },
      ]
    : tenantSidebarNavGroupsForLiveApp(session);
  const systemRail = isSystemAdmin;
  const showSectionHeaders = !systemRail && navGroups.length > 1;

  if (!authed || !session) return null;

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
        {navGroups.map((group, groupIndex) => {
          const sectionCollapsed =
            showSectionHeaders && railExpanded && collapsedCategories.has(group.category);
          const items: SidebarNavItem[] = group.items.map((i) => ({
            href: i.href,
            label: i.label,
            icon: i.icon,
          }));

          return (
            <div key={group.category} className={cn(groupIndex > 0 && "mt-1 border-t border-ds-border/60 pt-1")}>
              {showSectionHeaders && railExpanded ? (
                <button
                  type="button"
                  className={cn(
                    "flex h-8 w-full items-center gap-1 px-2 text-left transition-colors",
                    "text-[10px] font-bold uppercase tracking-[0.14em] text-ds-muted hover:text-ds-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring)]",
                  )}
                  aria-expanded={!sectionCollapsed}
                  onClick={() => toggleCategoryCollapsed(group.category)}
                >
                  <span className={cn(ICON_COL, "flex items-center justify-center")}>
                    {sectionCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </span>
                  <span className={labelVisibility}>{group.category}</span>
                </button>
              ) : null}
              {!sectionCollapsed
                ? items.map((item) => (
                    <SidebarNavLink
                      key={`${group.category}-${item.href}-${item.label}`}
                      item={item}
                      pathname={pathname}
                      labelVisibility={labelVisibility}
                    />
                  ))
                : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function SidebarNavLink({
  item,
  pathname,
  labelVisibility,
}: {
  item: SidebarNavItem;
  pathname: string;
  labelVisibility: string;
}) {
  const active = isPulseNavActive(item.href, pathname);
  const Icon = railIcon(item.icon);
  return (
    <Link
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
}
