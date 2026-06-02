"use client";

/**
 * Tenant / system left rail with workflow-oriented domain flyouts.
 *
 * Authorization is resolved once via {@link buildNavigationTree} (registry → matrix → RBAC).
 * This component performs no permission checks.
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
  ScanBarcode,
  ScrollText,
  Settings,
  ShoppingCart,
  Sparkles,
  UserCog,
  Users,
  Waves,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import type { NavDomain } from "@/config/platform/nav-domains";
import type { PlatformIconKey } from "@/config/platform/types";
import { pulseSystemSidebarNav, type PulseSidebarIcon } from "@/lib/pulse-app";
import { isPulseNavActive } from "@/lib/pulse-nav-active";
import { logSidebarResolution } from "@/lib/rbac/debugResolvedAccess";
import { buildNavigationTree } from "@/lib/navigation/build-navigation-tree";
import { DASHBOARD_SCOPE_LABEL } from "@/config/platform/dashboard-scope";
import type { NavigationTreeDomain, NavigationTreeItem } from "@/lib/navigation/build-navigation-tree";
import type { TenantNavIcon } from "@/config/platform/tenant-nav-registry";
import { cn } from "@/lib/cn";
import { navDomainTourSlug } from "@/lib/onboarding/domain-tour-slugs";
import { useOnboardingFlyoutBridge } from "@/lib/onboarding/onboarding-flyout-bridge";
import { TennisRacket } from "@/lib/icons/tennis-racket";

const ICONS: Record<string, LucideIcon> = {
  layout: LayoutDashboard,
  activity: Activity,
  calendar: CalendarDays,
  "folder-kanban": FolderKanban,
  clipboard: ClipboardList,
  "list-checks": ListChecks,
  sparkles: Sparkles,
  package: Package,
  "scan-barcode": ScanBarcode,
  wrench: Wrench,
  "map-pin": MapPin,
  radio: Radio,
  layers: Layers,
  building: Building2,
  "user-cog": UserCog,
  users: Users,
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
  "tennis-racket": TennisRacket,
  package: Package,
  "book-open": BookOpen,
  "bar-chart-2": BarChart2,
  "message-square": MessageSquare,
  newspaper: Newspaper,
  image: ImageIcon,
  calendar: CalendarDays,
  "layout-grid": LayoutGrid,
  "file-text": FileText,
  "shopping-cart": ShoppingCart,
};

const RAIL_ICONS: Record<string, LucideIcon> = { ...PLATFORM_DEPT_ICONS, ...ICONS };

function railIcon(icon: TenantNavIcon | PulseSidebarIcon | PlatformIconKey): LucideIcon {
  return RAIL_ICONS[icon] ?? LayoutDashboard;
}

const COLLAPSED_RAIL_W = "w-[var(--pulse-sidebar-collapsed-width)]";
const ICON_COL = `h-11 ${COLLAPSED_RAIL_W} shrink-0`;

const SIDENAV_ROW_ACTIVE_HOVER = "bg-[var(--ds-accent)]";
const SIDENAV_ROW_ACTIVE_HOVER_HOVER = "hover:bg-[var(--ds-accent)]";
const SIDENAV_ROW_BASE =
  "box-border flex min-h-11 h-11 w-full shrink-0 items-stretch rounded-none outline-none transition-colors duration-200 ease-out motion-reduce:transition-none";
/** Flyout rows — solid tile on the panel (not transparent). */
const FLYOUT_NAV_ROW_IDLE = "bg-white text-[var(--ds-text-primary)] dark:bg-ds-primary";

type SidebarNavItem = { href: string; label: string; icon: TenantNavIcon | PulseSidebarIcon | PlatformIconKey };

export function AppSideNav() {
  const pathname = usePathname();
  const { authed, session } = usePulseAuth();
  const [railExpanded, setRailExpanded] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);

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
  const navTree = useMemo(
    () => (isSystemAdmin ? [] : buildNavigationTree(session)),
    [isSystemAdmin, session],
  );
  const systemItems: SidebarNavItem[] = useMemo(
    () =>
      pulseSystemSidebarNav.map((i) => ({
        href: i.href,
        label: i.label,
        icon: i.icon,
      })),
    [],
  );

  if (!authed || !session) return null;

  const labelVisibility = cn(
    "min-w-0 truncate text-left text-[13px] font-semibold transition-[opacity,max-width,margin] duration-300 ease-in-out motion-reduce:transition-none",
    railExpanded ? "max-w-[200px] opacity-100" : "max-w-0 opacity-0",
    "group-focus-within/sidenav:max-w-[200px] group-focus-within/sidenav:opacity-100",
  );

  return (
    <aside
      ref={asideRef}
      data-tour="sidebar-navigation"
      onMouseEnter={() => setRailExpanded(true)}
      onMouseLeave={() => setRailExpanded(false)}
      className={cn(
        "group/sidenav hidden lg:flex fixed left-0 z-[40] flex-col overflow-visible rounded-none border-r border-ds-border bg-ds-primary",
        "top-[var(--pulse-header-height)] h-[calc(100vh-var(--pulse-header-height))]",
        "shadow-[var(--ds-shadow-card)] motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-in-out",
        railExpanded ? "w-[var(--pulse-sidebar-expanded-width)]" : COLLAPSED_RAIL_W,
      )}
      aria-label={isSystemAdmin ? "System navigation" : "App navigation"}
    >
      <nav
        className="relative flex min-h-0 flex-1 flex-col border-t border-ds-border bg-ds-primary"
        aria-label="Navigation"
      >
        {isSystemAdmin ? (
          systemItems.map((item) => (
            <SidebarNavLink
              key={item.href}
              item={item}
              pathname={pathname}
              labelVisibility={labelVisibility}
            />
          ))
        ) : (
          <TenantDomainFlyoutNav tree={navTree} pathname={pathname} railExpanded={railExpanded} labelVisibility={labelVisibility} />
        )}
      </nav>
    </aside>
  );
}

function TenantDomainFlyoutNav({
  tree,
  pathname,
  railExpanded,
  labelVisibility,
}: {
  tree: NavigationTreeDomain[];
  pathname: string;
  railExpanded: boolean;
  labelVisibility: string;
}) {
  const flyoutId = useId();
  const flyoutBridge = useOnboardingFlyoutBridge();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const domainButtonRefs = useRef<Partial<Record<NavDomain, HTMLButtonElement>>>({});
  const [hoverDomain, setHoverDomain] = useState<NavDomain | null>(null);
  const [pinnedDomain, setPinnedDomain] = useState<NavDomain | null>(null);
  const [flyoutAnchorTop, setFlyoutAnchorTop] = useState(0);
  const [shellHeight, setShellHeight] = useState(0);

  const routeActiveDomain = useMemo(() => domainForPathname(tree, pathname), [tree, pathname]);
  const tourFlyoutDomain = flyoutBridge?.tourFlyoutDomain ?? null;
  const openDomain = tourFlyoutDomain ?? pinnedDomain ?? hoverDomain;
  const openDomainNode = openDomain ? tree.find((d) => d.domain === openDomain) : undefined;

  const syncFlyoutAnchor = useCallback((domain: NavDomain) => {
    const btn = domainButtonRefs.current[domain];
    const shell = shellRef.current;
    if (!btn || !shell) return;
    setFlyoutAnchorTop(btn.offsetTop);
    setShellHeight(shell.clientHeight);
  }, []);

  const closeFlyout = useCallback(() => {
    setHoverDomain(null);
    setPinnedDomain(null);
  }, []);

  useLayoutEffect(() => {
    if (!openDomain) return;
    syncFlyoutAnchor(openDomain);
  }, [openDomain, syncFlyoutAnchor, tree.length, railExpanded]);

  useEffect(() => {
    if (flyoutBridge?.isTourActive) return;
    closeFlyout();
  }, [pathname, closeFlyout, flyoutBridge?.isTourActive]);

  useEffect(() => {
    if (!tourFlyoutDomain) return;
    setPinnedDomain(tourFlyoutDomain);
    setHoverDomain(tourFlyoutDomain);
    syncFlyoutAnchor(tourFlyoutDomain);
  }, [tourFlyoutDomain, syncFlyoutAnchor]);

  useEffect(() => {
    if (!openDomain) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFlyout();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openDomain, closeFlyout]);

  const handleShellMouseLeave = (e: React.MouseEvent) => {
    if (pinnedDomain) return;
    const next = e.relatedTarget;
    if (next instanceof Node && shellRef.current?.contains(next)) return;
    setHoverDomain(null);
  };

  const openFlyoutForDomain = (domain: NavDomain) => {
    setHoverDomain(domain);
    syncFlyoutAnchor(domain);
  };

  const togglePin = (domain: NavDomain) => {
    setPinnedDomain((prev) => (prev === domain ? null : domain));
    setHoverDomain(domain);
  };

  if (!tree.length) {
    return (
      <p className="px-2 py-3 text-xs text-ds-muted" role="status">
        No modules available for your role.
      </p>
    );
  }

  return (
    <div
      ref={shellRef}
      className="relative flex min-h-0 flex-1 flex-col"
      onMouseLeave={handleShellMouseLeave}
    >
      {tree.map((domainNode) => {
        const domainActive = domainNode.domain === routeActiveDomain;
        const flyoutOpen = openDomain === domainNode.domain;
        const Icon = railIcon(domainNode.icon);
        return (
          <button
            key={domainNode.domain}
            data-tour={`domain-rail-${navDomainTourSlug(domainNode.domain)}`}
            ref={(el) => {
              if (el) domainButtonRefs.current[domainNode.domain] = el;
              else delete domainButtonRefs.current[domainNode.domain];
            }}
            type="button"
            className={cn(
              SIDENAV_ROW_BASE,
              "group/domain bg-transparent text-left",
              domainActive || flyoutOpen
                ? SIDENAV_ROW_ACTIVE_HOVER
                : cn("bg-transparent", SIDENAV_ROW_ACTIVE_HOVER_HOVER),
              "focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring)] focus-visible:ring-offset-0",
            )}
            aria-haspopup="menu"
            aria-expanded={flyoutOpen}
            aria-controls={flyoutOpen ? `${flyoutId}-${domainNode.domain}` : undefined}
            onMouseEnter={() => openFlyoutForDomain(domainNode.domain)}
            onFocus={() => openFlyoutForDomain(domainNode.domain)}
            onClick={() => togglePin(domainNode.domain)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openFlyoutForDomain(domainNode.domain);
                setPinnedDomain(domainNode.domain);
              }
            }}
          >
            <span
              className={cn(
                ICON_COL,
                "flex items-center justify-center text-[var(--ds-text-primary)]",
                domainActive || flyoutOpen ? "text-white" : "group-hover/domain:text-white",
              )}
            >
              <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={2} aria-hidden />
            </span>
            <span
              className={cn(
                labelVisibility,
                "flex min-w-0 flex-1 items-center pr-3 text-[var(--ds-text-primary)]",
                domainActive || flyoutOpen ? "text-white" : "group-hover/domain:text-white",
              )}
            >
              {domainNode.label}
            </span>
          </button>
        );
      })}

      {openDomainNode ? (
        <NavFlyoutPanel
          id={`${flyoutId}-${openDomainNode.domain}`}
          domain={openDomainNode}
          pathname={pathname}
          pinned={pinnedDomain === openDomainNode.domain}
          railExpanded={railExpanded}
          anchorTop={flyoutAnchorTop}
          shellHeight={shellHeight}
          onPanelEnter={() => openFlyoutForDomain(openDomainNode.domain)}
          onClose={closeFlyout}
        />
      ) : null}
    </div>
  );
}

function NavFlyoutPanel({
  id,
  domain,
  pathname,
  pinned,
  railExpanded,
  anchorTop,
  shellHeight,
  onPanelEnter,
  onClose,
}: {
  id: string;
  domain: NavigationTreeDomain;
  pathname: string;
  pinned: boolean;
  railExpanded: boolean;
  anchorTop: number;
  shellHeight: number;
  onPanelEnter: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelTop, setPanelTop] = useState(anchorTop);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      setPanelTop(anchorTop);
      return;
    }
    const edgePadding = 8;
    const maxTop = Math.max(0, shellHeight - panel.offsetHeight - edgePadding);
    setPanelTop(Math.min(anchorTop, maxTop));
  }, [anchorTop, shellHeight, domain, pinned]);

  return (
    <div
      ref={panelRef}
      id={id}
      data-tour="domain-flyout"
      role="menu"
      aria-label={`${domain.label} modules`}
      style={{ top: panelTop }}
      className={cn(
        "absolute z-50 flex max-h-[min(70vh,calc(100vh-var(--pulse-header-height)-1rem))] w-[min(280px,calc(100vw-var(--pulse-sidebar-expanded-width)-1rem))] flex-col overflow-y-auto",
        "border border-ds-border bg-ds-secondary shadow-[var(--ds-shadow-card)]",
        railExpanded ? "left-[var(--pulse-sidebar-expanded-width)]" : "left-[var(--pulse-sidebar-collapsed-width)]",
      )}
      onMouseEnter={onPanelEnter}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {pinned ? (
        <div className="flex justify-end border-b border-ds-border px-2 py-1">
          <button
            type="button"
            className="text-[10px] font-semibold uppercase tracking-wide text-ds-muted hover:text-ds-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring)]"
            onClick={onClose}
          >
            Unpin
          </button>
        </div>
      ) : null}
      <div className="flex flex-col">
        {domain.groups.map((group) => (
          <div key={group.group} role="presentation">
            <ul className="flex flex-col" role="none">
              {group.items.map((item) => (
                <li key={item.key} role="none">
                  <FlyoutNavLink item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function flyoutItemTitle(item: NavigationTreeItem): string {
  if (!item.dashboardScope) return item.label;
  const scope = DASHBOARD_SCOPE_LABEL[item.dashboardScope];
  const dept = item.ownershipDepartment ? ` · ${item.ownershipDepartment}` : "";
  return `${item.label} (${scope}${dept})`;
}

function FlyoutNavLink({ item, pathname }: { item: NavigationTreeItem; pathname: string }) {
  const active = isPulseNavActive(item.href, pathname);
  return (
    <Link
      href={item.href}
      role="menuitem"
      title={flyoutItemTitle(item)}
      data-tour={`flyout-item-${item.key}`}
      data-guided-tour-anchor={item.href === "/dashboard/maintenance" ? "sidebar-work-requests" : undefined}
      className={cn(
        SIDENAV_ROW_BASE,
        "group/flyout items-center px-3",
        active ? SIDENAV_ROW_ACTIVE_HOVER : cn(FLYOUT_NAV_ROW_IDLE, SIDENAV_ROW_ACTIVE_HOVER_HOVER),
        "focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring)] focus-visible:ring-offset-0",
      )}
    >
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-left text-[13px] font-semibold",
          active ? "text-white" : "group-hover/flyout:text-white",
        )}
      >
        {item.label}
      </span>
    </Link>
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
      className={cn(
        SIDENAV_ROW_BASE,
        "group/nav",
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

function domainForPathname(tree: readonly NavigationTreeDomain[], pathname: string): NavDomain | null {
  for (const domain of tree) {
    for (const group of domain.groups) {
      for (const item of group.items) {
        if (isPulseNavActive(item.href, pathname)) return domain.domain;
      }
    }
  }
  return null;
}
