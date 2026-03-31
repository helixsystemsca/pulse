"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  MapPin,
  Package,
  ScrollText,
  Shield,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseSystemSidebarNav, pulseTenantSidebarNav, type PulseSidebarIcon } from "@/lib/pulse-app";
import { isPulseNavActive } from "@/lib/pulse-nav-active";

const ICONS: Record<PulseSidebarIcon, LucideIcon> = {
  layout: LayoutDashboard,
  calendar: CalendarDays,
  clipboard: ClipboardList,
  package: Package,
  wrench: Wrench,
  users: Users,
  "map-pin": MapPin,
  gauge: Gauge,
  shield: Shield,
  building: Building2,
  "user-cog": UserCog,
  "scroll-text": ScrollText,
};

export function AppSideNav() {
  const pathname = usePathname();
  const { authed, session } = usePulseAuth();

  if (!authed) return null;

  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const onSystem = pathname.startsWith("/system");
  const items = onSystem && isSystemAdmin ? pulseSystemSidebarNav : pulseTenantSidebarNav;
  const dark = onSystem && isSystemAdmin;

  return (
    <aside
      className={`group/sidebar sticky top-0 z-30 hidden h-screen w-[4.25rem] shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 ease-out hover:w-56 lg:flex ${dark ? "border-zinc-800 bg-zinc-950" : "border-slate-200/90 bg-[#f4f5f7]"}`}
      aria-label="App"
    >
      <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
        {items.map((item) => {
          const active = isPulseNavActive(item.href, pathname);
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              title={item.label}
              className={`relative flex min-h-[2.75rem] items-center gap-3 rounded-l-lg py-2 pl-2 pr-3 text-sm font-semibold transition-colors ${
                dark
                  ? active
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-100"
                  : active
                    ? "bg-sky-50/95 text-[#1e4a8a]"
                    : "text-slate-600 hover:bg-white/60 hover:text-pulse-navy"
              } ${active ? "border-r-[3px] border-[#2B4C7E]" : "border-r-[3px] border-transparent"}`}
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
                className="min-w-0 max-w-0 overflow-hidden text-ellipsis whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 ease-out group-hover/sidebar:max-w-[11rem] group-hover/sidebar:opacity-100"
                style={{ transitionProperty: "max-width, opacity" }}
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
