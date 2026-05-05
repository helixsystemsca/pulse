"use client";

/**
 * Tenant / system left rail: grouped nav, in-rail search, full-height shell, footer profile.
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
  Search,
  Settings,
  Sparkles,
  UserCog,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
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
  sessionRoleDisplayLabel,
} from "@/lib/pulse-roles";
import { useSidebarState } from "@/components/app/SidebarState";
import { cn } from "@/lib/cn";

/** Icon tile: white square, dark glyph (white fill + white icon is illegible); active = solid teal/ice (`--ds-accent`) + black icon; hover scales up. */
const navIconTile = (active: boolean) =>
  cn(
    "flex shrink-0 items-center justify-center rounded-lg shadow-sm transition-transform duration-200 ease-out motion-safe:will-change-transform",
    "ring-1 ring-black/[0.08] dark:ring-black/[0.1]",
    active
      ? "bg-[var(--ds-accent)] text-black shadow-md ring-0 motion-safe:group-hover:scale-110"
      : "bg-white text-zinc-900 motion-safe:group-hover:scale-110 dark:bg-white dark:text-zinc-900",
  );

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

function navInitials(name: string | null | undefined, email: string): string {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (p.length >= 2) return (p[0]![0] + p[p.length - 1]![0]).toUpperCase();
    return p[0]!.slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "?";
}

function formatRoleLabel(session: PulseAuthSession): string {
  if (session.is_system_admin || session.role === "system_admin") return "Platform admin";
  return sessionRoleDisplayLabel(session);
}

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
  const [navSearch, setNavSearch] = useState("");
  const { isSidebarOpen, closeSidebar } = useSidebarState();

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
    // Demo viewer: show all pages/tabs in the nav (still view-only; writes blocked server-side).
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
  // Settings lives in the persistent bottom section (not the main nav list).
  items = items.filter((i) => i.href !== "/settings");
  const systemRail = isSystemAdmin;

  const filteredNavItems = useMemo(() => {
    const q = navSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.href.toLowerCase().includes(q),
    );
  }, [items, navSearch]);

  if (!authed || !session) return null;

  const collapsedWidth = "w-16";
  const expandedWidth = "w-[17rem]";
  const railShell =
    "flex h-full min-h-0 flex-col justify-between border-r border-ds-sidebar-border bg-ds-sidebar text-ds-sidebar-fg";

  return (
    <div className="relative z-20 hidden h-full w-16 shrink-0 overflow-visible lg:block">
      {/* Collapsed rail (in-flow below header; reserves horizontal space for main). */}
      <aside className={`${railShell} ${collapsedWidth}`} aria-label={systemRail ? "System navigation" : "App navigation"}>
        <div className="flex min-h-0 flex-1 flex-col">
          <nav className="space-y-1 px-2 pt-3" aria-label="Navigation">
            {filteredNavItems.map((item) => {
              const active = isPulseNavActive(item.href, pathname);
              const Icon = ICONS[item.icon];
              return (
                <Link
                  key={`${item.href}-${item.label}-collapsed`}
                  href={item.href}
                  title={item.label}
                  data-guided-tour-anchor={item.href === "/dashboard/maintenance" ? "sidebar-work-requests" : undefined}
                  className="group flex items-center justify-center rounded-xl px-2 py-2 text-[13px] font-semibold leading-tight outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ds-sidebar)]"
                >
                  <span className={cn(navIconTile(active), "h-9 w-9")}>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="sr-only">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-ds-sidebar-border px-2 py-3">
            {canOpenOrgSettings ? (
              <Link
                href="/settings"
                title="Settings"
                className="group flex items-center justify-center rounded-xl px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ds-sidebar)]"
              >
                <span className={cn(navIconTile(false), "h-9 w-9")}>
                  <Settings className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <span className="sr-only">Settings</span>
              </Link>
            ) : null}
          </div>
        </div>
      </aside>

      {/* Expanded panel: overlays main (not header); sibling backdrop lives in `AppMainChromeColumn`. */}
      <aside
        className={[
          "absolute left-0 top-0 z-[80] hidden h-full flex-col justify-between border-r border-ds-sidebar-border bg-ds-sidebar text-ds-sidebar-fg shadow-[4px_0_24px_rgba(0,0,0,0.12)] lg:flex dark:shadow-[4px_0_28px_rgba(0,0,0,0.45)]",
          expandedWidth,
          "transition-transform duration-200 ease-out",
          isSidebarOpen ? "pointer-events-auto translate-x-0" : "pointer-events-none -translate-x-full",
        ].join(" ")}
        aria-hidden={!isSidebarOpen}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2 pt-3">
            <div className="px-3 pb-1">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-sidebar-muted"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  type="search"
                  value={navSearch}
                  onChange={(e) => setNavSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-full border border-ds-sidebar-border bg-ds-sidebar-well py-2 pl-9 pr-3 text-sm text-ds-sidebar-fg shadow-inner placeholder:text-ds-sidebar-muted focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ds-accent)_32%,transparent)]"
                  aria-label="Filter navigation"
                />
              </div>
            </div>

            <nav className="space-y-0.5 px-2" aria-label="Navigation">
              {filteredNavItems.map((item) => {
                const active = isPulseNavActive(item.href, pathname);
                const Icon = ICONS[item.icon];
                return (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    title={item.label}
                    onClick={() => closeSidebar()}
                    data-guided-tour-anchor={item.href === "/dashboard/maintenance" ? "sidebar-work-requests" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold leading-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ds-sidebar)]",
                      active ? "text-ds-sidebar-fg" : "text-ds-sidebar-muted hover:text-ds-sidebar-fg",
                    )}
                  >
                    <span className={cn(navIconTile(active), "h-8 w-8")}>
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-ds-sidebar-border px-3 pt-3">
            {canOpenOrgSettings ? (
              <Link
                href="/settings"
                onClick={() => closeSidebar()}
                className="group mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-ds-sidebar-border bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 shadow-sm transition-transform duration-200 ease-out motion-safe:hover:scale-[1.02] dark:bg-white"
              >
                <Settings className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                Settings
              </Link>
            ) : null}
            {isDemoViewer ? (
              <div
                className="mb-2 rounded-lg border border-[rgba(255,105,180,0.35)] bg-[linear-gradient(135deg,#ff7aa2_0%,#ff5f87_40%,#ff3d6e_100%)] px-3 py-2 text-xs font-semibold text-white shadow-sm"
                style={{ boxShadow: "0 10px 22px rgba(255, 61, 110, 0.18)" }}
              >
                Demo Mode – View only
              </div>
            ) : null}
            <div className="pb-3" />
          </div>
        </div>
      </aside>
    </div>
  );
}
