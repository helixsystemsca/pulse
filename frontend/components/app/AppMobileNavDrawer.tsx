"use client";

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
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { NavDomain } from "@/config/platform/nav-domains";
import type { PlatformIconKey } from "@/config/platform/types";
import { pulseSystemSidebarNav, type PulseSidebarIcon } from "@/lib/pulse-app";
import { isPulseNavActive } from "@/lib/pulse-nav-active";
import { buildNavigationTree } from "@/lib/navigation/build-navigation-tree";
import type { NavigationTreeDomain } from "@/lib/navigation/build-navigation-tree";
import type { TenantNavIcon } from "@/config/platform/tenant-nav-registry";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { useSidebarState } from "@/components/app/SidebarState";
import { cn } from "@/lib/cn";
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
  megaphone: Megaphone,
  waves: Waves,
  dumbbell: Dumbbell,
  "book-open": BookOpen,
  "bar-chart-2": BarChart2,
  "message-square": MessageSquare,
  newspaper: Newspaper,
  image: ImageIcon,
  "layout-grid": LayoutGrid,
  "file-text": FileText,
  "shopping-cart": ShoppingCart,
  "tennis-racket": TennisRacket,
};

function navIcon(icon: TenantNavIcon | PulseSidebarIcon | PlatformIconKey): LucideIcon {
  return ICONS[icon] ?? LayoutDashboard;
}

function activeDomainForPath(tree: NavigationTreeDomain[], pathname: string): NavDomain | null {
  for (const domain of tree) {
    for (const group of domain.groups) {
      for (const item of group.items) {
        if (isPulseNavActive(item.href, pathname)) return domain.domain;
      }
    }
  }
  return null;
}

export function AppMobileNavDrawer() {
  const pathname = usePathname();
  const { authed, session } = usePulseAuth();
  const { isSidebarOpen, closeSidebar } = useSidebarState();
  const [mounted, setMounted] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<NavDomain | null>(null);

  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const navTree = useMemo(
    () => (isSystemAdmin ? [] : buildNavigationTree(session)),
    [isSystemAdmin, session],
  );
  const routeDomain = useMemo(() => activeDomainForPath(navTree, pathname), [navTree, pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isSidebarOpen) {
      setExpandedDomain(routeDomain ?? navTree[0]?.domain ?? null);
    }
  }, [isSidebarOpen, routeDomain, navTree]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isSidebarOpen]);

  if (!mounted || !authed || !session || !isSidebarOpen) return null;

  const drawer = (
    <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close navigation menu"
        onClick={closeSidebar}
      />
      <aside
        className="absolute left-0 top-0 flex h-[100dvh] w-[min(18.5rem,88vw)] flex-col border-r border-ds-border bg-ds-primary shadow-2xl"
        aria-label={isSystemAdmin ? "System navigation" : "App navigation"}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-b border-ds-border px-4"
          style={{ minHeight: "var(--pulse-header-bar-height)" }}
        >
          <p className="text-sm font-semibold text-ds-foreground">Menu</p>
          <button
            type="button"
            className="rounded-lg p-2 text-ds-muted hover:bg-ds-secondary hover:text-ds-foreground"
            aria-label="Close menu"
            onClick={closeSidebar}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2" aria-label="Navigation">
          {isSystemAdmin ? (
            <ul className="flex flex-col">
              {pulseSystemSidebarNav.map((item) => {
                const active = isPulseNavActive(item.href, pathname);
                const Icon = navIcon(item.icon);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeSidebar}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm font-semibold",
                        active
                          ? "bg-[var(--ds-accent)] text-white"
                          : "text-ds-foreground hover:bg-ds-secondary",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : navTree.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ds-muted">No modules available for your role.</p>
          ) : (
            <ul className="flex flex-col">
              {navTree.map((domain) => {
                const open = expandedDomain === domain.domain;
                const Icon = navIcon(domain.icon);
                const domainActive = domain.domain === routeDomain;
                return (
                  <li key={domain.domain} className="border-b border-ds-border/60 last:border-b-0">
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold",
                        domainActive ? "text-[var(--ds-accent)]" : "text-ds-foreground",
                      )}
                      aria-expanded={open}
                      onClick={() =>
                        setExpandedDomain((prev) => (prev === domain.domain ? null : domain.domain))
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                      <span className="min-w-0 flex-1">{domain.label}</span>
                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
                        aria-hidden
                      />
                    </button>
                    {open ? (
                      <ul className="pb-2">
                        {domain.groups.flatMap((group) =>
                          group.items.map((item) => {
                            const active = isPulseNavActive(item.href, pathname);
                            return (
                              <li key={item.key}>
                                <Link
                                  href={item.href}
                                  onClick={closeSidebar}
                                  className={cn(
                                    "block py-2.5 pl-11 pr-4 text-sm font-medium",
                                    active
                                      ? "bg-[var(--ds-accent)] text-white"
                                      : "text-ds-foreground hover:bg-ds-secondary",
                                  )}
                                >
                                  {item.label}
                                </Link>
                              </li>
                            );
                          }),
                        )}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </aside>
    </div>
  );

  return createPortal(drawer, document.body);
}
