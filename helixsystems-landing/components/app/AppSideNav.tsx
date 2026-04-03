"use client";

/**
 * Collapsible icon rail: tenant links (dashboard, compliance, schedule, marketing anchors) or,
 * on `/system/*`, system-admin links. Expands on hover (desktop) or tap (mobile).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  MapPin,
  Package,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseSystemSidebarNav, pulseTenantSidebarNav, type PulseSidebarIcon } from "@/lib/pulse-app";
import { isPulseNavActive } from "@/lib/pulse-nav-active";

const ICONS: Record<PulseSidebarIcon, LucideIcon> = {
  layout: LayoutDashboard,
  calendar: CalendarDays,
  "folder-kanban": FolderKanban,
  clipboard: ClipboardList,
  package: Package,
  wrench: Wrench,
  users: Users,
  "map-pin": MapPin,
  gauge: Gauge,
  "shield-check": ShieldCheck,
  "credit-card": CreditCard,
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
  const items = isSystemAdmin ? pulseSystemSidebarNav : pulseTenantSidebarNav;
  const dark = isSystemAdmin;

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
        className={`group/sidebar fixed left-3 top-1/2 z-[40] flex max-h-[min(85vh,52rem)] w-[4.25rem] -translate-y-1/2 flex-col overflow-hidden overflow-y-auto rounded-2xl border shadow-xl shadow-slate-900/10 transition-[width,box-shadow] duration-200 ease-out lg:hover:w-56 lg:hover:shadow-2xl lg:hover:shadow-slate-900/18 ${
          narrowExpanded ? "max-lg:w-56 max-lg:shadow-2xl max-lg:shadow-slate-900/18" : ""
        } ${dark ? "border-zinc-800 bg-zinc-950" : "border-slate-200/90 bg-[#f4f5f7]"}`}
        aria-label="App"
      >
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
                className={`relative flex min-h-[2.75rem] items-center gap-3 rounded-xl py-2 pl-2 pr-3 text-sm font-semibold transition-colors ${
                  dark
                    ? active
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-100"
                    : active
                      ? "bg-sky-50/95 text-[#1e4a8a]"
                      : "text-slate-600 hover:bg-white/60 hover:text-pulse-navy"
                } ${active ? "ring-2 ring-[#2B4C7E]/25" : ""}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    dark
                      ? active
                        ? "bg-zinc-800 text-white"
                        : "bg-zinc-900 text-zinc-400"
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
          className="flex shrink-0 items-center justify-center border-t border-slate-200/80 py-2 lg:hidden dark:border-zinc-800"
          onClick={() => setNarrowExpanded((o) => !o)}
          aria-expanded={narrowExpanded}
          aria-label={narrowExpanded ? "Collapse navigation" : "Expand navigation"}
        >
          <ChevronRight
            className={`h-4 w-4 text-pulse-muted transition-transform dark:text-zinc-400 ${narrowExpanded ? "rotate-180" : ""}`}
            strokeWidth={2}
            aria-hidden
          />
        </button>
      </aside>
    </>
  );
}
