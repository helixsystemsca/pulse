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
  ShieldCheck,
  UserCog,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { CompanyLogo } from "@/components/branding/CompanyLogo";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseSystemSidebarNav, pulseTenantSidebarNav, type PulseSidebarIcon } from "@/lib/pulse-app";
import { isPulseNavActive } from "@/lib/pulse-nav-active";
import { isTenantNavFeatureEnabled } from "@/lib/pulse-nav-features";

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
  "shield-check": ShieldCheck,
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
    !isSystemAdmin && session?.role === "worker"
      ? rawNav.filter((i) => i.href !== "/monitoring")
      : [...rawNav];
  if (!isSystemAdmin && session) {
    items = items.filter((i) => isTenantNavFeatureEnabled(i.href, session.enabled_features));
  }
  const dark = isSystemAdmin;
  const stealthTenantChrome =
    !isSystemAdmin &&
    Boolean(pathname && (pathname === "/overview" || pathname.startsWith("/dashboard")));

  return (
    <>
      {narrowExpanded ? (
        <button
          type="button"
          className="fixed inset-0 z-[35] bg-slate-900/25 backdrop-blur-[1px] lg:hidden"
          aria-label="Close menu"
          onClick={() => setNarrowExpanded(false)}
        />
      ) : null}

      <aside
        className={`group/sidebar fixed left-3 top-1/2 z-[40] flex max-h-[min(85vh,52rem)] w-[4.25rem] -translate-y-1/2 flex-col overflow-hidden overflow-y-auto rounded-2xl border transition-[width,box-shadow] duration-200 ease-out lg:hover:w-56 ${
          stealthTenantChrome
            ? "shadow-stealth-card lg:hover:shadow-[0_3px_12px_rgba(0,0,0,0.45)]"
            : "shadow-xl shadow-slate-900/10 lg:hover:shadow-2xl lg:hover:shadow-slate-900/18"
        } ${
          narrowExpanded
            ? stealthTenantChrome
              ? "max-lg:shadow-[0_3px_12px_rgba(0,0,0,0.45)]"
              : "max-lg:shadow-2xl max-lg:shadow-slate-900/18"
            : ""
        } ${
          dark
            ? "border-zinc-800 bg-zinc-950"
            : stealthTenantChrome
              ? "border-stealth-border bg-stealth-main"
              : "border-slate-200/90 bg-[#f4f5f7] dark:border-slate-700 dark:bg-slate-900"
        }`}
        aria-label="App"
      >
        {!dark && session?.company ? (
          <div
            className={`border-b px-2 py-2 ${stealthTenantChrome ? "border-stealth-border" : "border-slate-200/80"}`}
          >
            <Link
              href="/overview"
              title={session.company.name}
              onClick={() => setNarrowExpanded(false)}
              className="flex justify-center lg:justify-start"
            >
              <CompanyLogo
                logoUrl={session.company.logo_url}
                companyName={session.company.name}
                showName={false}
                variant={stealthTenantChrome ? "dark" : "light"}
              />
            </Link>
          </div>
        ) : null}
        <nav className="flex flex-col gap-1 px-2 py-3">
          {items.map((item) => {
            const active = isPulseNavActive(item.href, pathname);
            const Icon = ICONS[item.icon];
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                title={item.label}
                onClick={() => setNarrowExpanded(false)}
                className={`relative flex min-h-[2.75rem] items-center gap-3 rounded-xl py-2 pl-2 pr-3 text-sm font-semibold transition-[color,background-color,box-shadow] ${
                  dark
                    ? active
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-100"
                    : stealthTenantChrome
                      ? active
                        ? "bg-stealth-card text-stealth-primary shadow-stealth-card"
                        : "text-stealth-muted hover:bg-stealth-card/60 hover:text-stealth-primary"
                      : active
                        ? "bg-sky-50/95 text-[#1e4a8a]"
                        : "text-slate-600 hover:bg-white/60 hover:text-pulse-navy"
                } ${active && !stealthTenantChrome ? "ring-2 ring-[#2B4C7E]/25" : ""} ${
                  active && stealthTenantChrome ? "ring-1 ring-stealth-border" : ""
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    dark
                      ? active
                        ? "bg-zinc-800 text-white"
                        : "bg-zinc-900 text-zinc-400"
                      : stealthTenantChrome
                        ? active
                          ? "bg-stealth-main text-stealth-accent"
                          : "bg-stealth-card/80 text-stealth-muted"
                        : active
                          ? "bg-white text-[#2B4C7E] shadow-sm ring-1 ring-sky-200/60"
                          : "bg-white/50 text-slate-500"
                  }`}
                >
                  <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} aria-hidden />
                </span>
                <span
                  className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out lg:max-w-0 lg:opacity-0 lg:group-hover/sidebar:max-w-[11rem] lg:group-hover/sidebar:opacity-100 ${
                    narrowExpanded ? "max-w-[11rem] opacity-100" : "max-w-0 opacity-0"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className={`flex shrink-0 items-center justify-center border-t py-2 lg:hidden dark:border-zinc-800 ${
            stealthTenantChrome ? "border-stealth-border" : "border-slate-200/80"
          }`}
          onClick={() => setNarrowExpanded((o) => !o)}
          aria-expanded={narrowExpanded}
          aria-label={narrowExpanded ? "Collapse navigation" : "Expand navigation"}
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform dark:text-zinc-400 ${
              stealthTenantChrome ? "text-stealth-muted" : "text-pulse-muted"
            } ${narrowExpanded ? "rotate-180" : ""}`}
            strokeWidth={2}
            aria-hidden
          />
        </button>
      </aside>
    </>
  );
}
