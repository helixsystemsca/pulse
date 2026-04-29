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
  Bell,
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
    "flex w-64 shrink-0 flex-col border-r border-slate-200/90 bg-[#f4f6f8] dark:border-white/[0.08] dark:bg-[#161a1d] " +
    "sticky top-16 z-[40] hidden min-h-0 self-stretch lg:flex";

  return (
    <aside className={shell} aria-label={systemRail ? "System navigation" : "App navigation"}>
      {/* Brand + quick action */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-3">
        <Link
          href={isSystemAdmin ? "/system" : "/overview"}
          className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none ring-offset-2 ring-offset-[#f4f6f8] focus-visible:ring-2 focus-visible:ring-teal-500/50 dark:ring-offset-[#161a1d]"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-sm font-bold text-white shadow-sm dark:bg-teal-500"
            aria-hidden
          >
            H
          </span>
          <span className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Helix</span>
        </Link>
        <Link
          href={isSystemAdmin ? "/system/logs" : "/monitoring"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
          aria-label={isSystemAdmin ? "System logs" : "Monitoring and alerts"}
        >
          <Bell className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} aria-hidden />
        </Link>
      </div>

      {/* In-rail search */}
      <div className="shrink-0 px-3 pb-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-full border-0 bg-slate-200/70 py-2.5 pl-9 pr-3 text-sm text-slate-800 shadow-inner placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:bg-white/[0.08] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-teal-400/30"
            aria-label="Filter navigation"
          />
        </div>
      </div>

      {/* Flat nav list — no expandable groups */}
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2 pb-2" aria-label="Navigation">
        {filteredNavItems.map((item) => {
          const active = isPulseNavActive(item.href, pathname);
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              title={item.label}
              data-guided-tour-anchor={item.href === "/dashboard/maintenance" ? "sidebar-work-requests" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold leading-tight transition-colors ${
                active
                  ? "bg-teal-500/[0.14] text-teal-800 shadow-sm dark:bg-teal-400/15 dark:text-teal-100"
                  : "text-slate-700 hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-white/[0.06]"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  active
                    ? "bg-white text-teal-700 shadow-sm ring-1 ring-teal-500/20 dark:bg-white/10 dark:text-teal-200 dark:ring-teal-400/25"
                    : "bg-slate-200/50 text-slate-500 group-hover:bg-slate-200/90 group-hover:text-slate-700 dark:bg-white/[0.06] dark:text-slate-400 dark:group-hover:bg-white/[0.1] dark:group-hover:text-slate-200"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Profile footer — pinned to bottom of rail */}
      <div className="mt-auto shrink-0 border-t border-slate-200/90 px-3 py-3 dark:border-white/[0.08]">
        <Link
          href="/settings"
          className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300/80 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white dark:border-white/[0.14] dark:bg-white/[0.05] dark:text-slate-100 dark:hover:bg-white/[0.08]"
        >
          <Settings className="h-4 w-4" aria-hidden />
          Settings
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white dark:bg-teal-500">
            {navInitials(session.full_name, session.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {session.full_name?.trim() || session.email.split("@")[0]}
            </p>
            <p className="truncate text-xs capitalize text-slate-500 dark:text-slate-400">{formatRoleLabel(session)}</p>
          </div>
          <Link
            href="/settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
            aria-label="Open settings"
          >
            <Settings className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
      </div>
    </aside>
  );
}
