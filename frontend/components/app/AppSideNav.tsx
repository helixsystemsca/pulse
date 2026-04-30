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
import { pulseSystemSidebarNav, pulseTenantSidebarNav, type PulseSidebarIcon } from "@/lib/pulse-app";
import { isPulseNavActive } from "@/lib/pulse-nav-active";
import { isTenantNavFeatureEnabled } from "@/lib/pulse-nav-features";
import { isTenantNavPermissionGranted } from "@/lib/pulse-nav-permissions";
import { sessionHasAnyRole, sessionPrimaryRole } from "@/lib/pulse-roles";

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
  const r = session.role ?? "member";
  return r.replace(/_/g, " ");
}

export function AppSideNav() {
  const pathname = usePathname();
  const { authed, session } = usePulseAuth();
  const [navSearch, setNavSearch] = useState("");

  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const rawNav = isSystemAdmin ? pulseSystemSidebarNav : pulseTenantSidebarNav;
  let items =
    !isSystemAdmin && sessionPrimaryRole(session) === "worker"
      ? rawNav.filter((i) => i.href !== "/monitoring")
      : [...rawNav];
  if (!isSystemAdmin && session) {
    items = items.filter((i) => isTenantNavFeatureEnabled(i.href, session.enabled_features));
    items = items.filter((i) => {
      if (i.href === "/dashboard/workers" || i.href.startsWith("/dashboard/workers")) {
        if (!sessionHasAnyRole(session, "company_admin")) return false;
        if (!isTenantNavPermissionGranted(i.href, session.permissions)) return false;
        return true;
      }
      return isTenantNavPermissionGranted(i.href, session.permissions);
    });
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

  const shell =
    "hidden w-64 min-w-[16rem] flex-shrink-0 flex-col justify-between border-r bg-background lg:flex";

  return (
    <aside className={shell} aria-label={systemRail ? "System navigation" : "App navigation"}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2 pt-3">
          <div className="px-3 pb-1">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2}
                aria-hidden
              />
              <input
                type="search"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground shadow-inner placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ds-success)_35%,transparent)]"
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
                  data-guided-tour-anchor={item.href === "/dashboard/maintenance" ? "sidebar-work-requests" : undefined}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold leading-tight transition-colors ${
                    active
                      ? "bg-ds-interactive-hover-strong text-ds-foreground shadow-sm"
                      : "text-foreground/80 hover:bg-ds-interactive-hover"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      active
                        ? "bg-background text-ds-success shadow-sm ring-1 ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)]"
                        : "bg-ds-secondary/60 text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-border px-3 pt-3">
          <Link
            href="/settings"
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-ds-interactive-hover"
          >
            <Settings className="h-4 w-4" aria-hidden />
            Settings
          </Link>
          <div className="flex items-center gap-3 pb-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {session.full_name?.trim() || session.email.split("@")[0]}
              </p>
              <p className="truncate text-xs capitalize text-muted-foreground">{formatRoleLabel(session)}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
