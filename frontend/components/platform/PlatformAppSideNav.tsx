"use client";

/**
 * Department workspace rail: generated from module registry + `/auth/me` RBAC + contract modules.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  MessageSquare,
  Newspaper,
  Package,
  ScrollText,
  Waves,
  Wrench,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buildDepartmentNavItems } from "@/config/platform/navigation";
import type { PlatformIconKey } from "@/config/platform/types";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { cn } from "@/lib/cn";
import { isPlatformDepartmentPath } from "@/lib/platform/path-detection";

const ICONS: Record<PlatformIconKey, LucideIcon> = {
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

const COLLAPSED_RAIL_W = "w-[var(--pulse-sidebar-collapsed-width)]";
const ICON_COL = `h-11 ${COLLAPSED_RAIL_W} shrink-0`;
const SIDENAV_ROW_ACTIVE_HOVER = "bg-[var(--ds-accent)]";
const SIDENAV_ROW_ACTIVE_HOVER_HOVER = "hover:bg-[var(--ds-accent)]";

function isPlatformNavActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PlatformAppSideNav() {
  const pathname = usePathname();
  const { session } = usePulseAuth();
  const [railExpanded, setRailExpanded] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);

  const departmentSlug = pathname.split("/").filter(Boolean)[0] ?? "maintenance";

  useEffect(() => {
    setRailExpanded(false);
    const root = asideRef.current;
    if (!root) return;
    const ae = document.activeElement;
    if (ae instanceof HTMLElement && root.contains(ae)) ae.blur();
  }, [pathname]);

  const items = buildDepartmentNavItems(departmentSlug, session);

  const labelVisibility = cn(
    "min-w-0 truncate text-left text-[13px] font-semibold transition-[opacity,max-width,margin] duration-300 ease-in-out motion-reduce:transition-none",
    railExpanded ? "max-w-[200px] opacity-100" : "max-w-0 opacity-0",
    "group-focus-within/sidenav:max-w-[200px] group-focus-within/sidenav:opacity-100",
  );

  if (!isPlatformDepartmentPath(pathname)) return null;

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
      aria-label="Department workspace navigation"
    >
      <nav className="flex min-h-0 flex-1 flex-col border-t border-ds-border bg-ds-primary" aria-label="Department modules">
        {items.map((item) => {
          const active = isPlatformNavActive(item.href, pathname);
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
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
