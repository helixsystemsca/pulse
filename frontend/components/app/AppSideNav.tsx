"use client";

/**
 * Full sidebar: tenant links (dashboard, compliance, schedule, marketing anchors) or,
 * on `/system/*`, system-admin links.
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
  Settings,
  Sparkles,
  UserCog,
  Wrench,
} from "lucide-react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseSystemSidebarNav, pulseTenantSidebarNav, type PulseSidebarIcon } from "@/lib/pulse-app";
import { isPulseNavActive } from "@/lib/pulse-nav-active";
import { isTenantNavFeatureEnabled } from "@/lib/pulse-nav-features";
import { isTenantNavPermissionGranted } from "@/lib/pulse-nav-permissions";
import { sessionHasAnyRole, sessionPrimaryRole } from "@/lib/pulse-roles";
import { useMemo, useState } from "react";

/** First word on line 1, remaining words on line 2 — fits narrow expanded rail. */
function splitNavLabel(label: string): { line1: string; line2: string | null } {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { line1: label.trim(), line2: null };
  return { line1: parts[0]!, line2: parts.slice(1).join(" ") };
}

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

export function AppSideNav() {
  const pathname = usePathname();
  const { authed, session } = usePulseAuth();

  if (!authed) return null;

  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  /** Platform shell: always use the slim system rail (not tenant product links). Imp JWTs look like tenant users. */
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

  const tenantShell =
    "border border-ds-border bg-ds-sidebar shadow-[var(--ds-shadow-card)] backdrop-blur-md lg:hover:shadow-[var(--ds-shadow-card-hover)]";

  const sections = useMemo((): Array<{ id: string; title: string; hrefs: string[] }> => {
    if (systemRail) {
      return [{ id: "system", title: "System", hrefs: items.map((i) => i.href) }];
    }
    return [
      {
        id: "operations",
        title: "Operations",
        hrefs: ["/overview", "/dashboard/maintenance", "/schedule", "/monitoring"],
      },
      {
        id: "field-work",
        title: "Field Work",
        hrefs: ["/dashboard/compliance", "/dashboard/procedures"],
      },
      {
        id: "management",
        title: "Management",
        hrefs: ["/projects", "/dashboard/team-insights", "/dashboard/workers"],
      },
      {
        id: "assets",
        title: "Assets",
        hrefs: ["/equipment", "/dashboard/inventory", "/devices", "/zones-devices/zones", "/live-map"],
      },
      {
        id: "system",
        title: "System",
        hrefs: ["/settings"],
      },
    ];
  }, [items, systemRail]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => ({
    operations: true,
    "field-work": false,
    management: false,
    assets: false,
    system: false,
  }));

  return (
    <aside
      className={`sticky top-16 z-[40] hidden w-64 self-start border-r ${tenantShell} lg:flex`}
      aria-label={systemRail ? "System navigation" : "App navigation"}
    >
      <nav className="flex flex-col gap-2 p-2">
        {sections.map((section) => {
          const isOpen = systemRail ? true : Boolean(openSections[section.id]);
          const sectionItems = items.filter((i) => section.hrefs.includes(i.href));

          return (
            <div key={section.id}>
              <button
                type="button"
                onClick={() => {
                  if (systemRail) return;
                  setOpenSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }));
                }}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
                  {section.title}
                </span>
                {!systemRail ? (
                  <span className="text-[#9ca3af]">{isOpen ? "–" : "+"}</span>
                ) : null}
              </button>

              {isOpen ? (
                <div className="mt-1 flex flex-col gap-0.5">
                  {sectionItems.map((item) => {
                    const active = isPulseNavActive(item.href, pathname);
                    const Icon = ICONS[item.icon];
                    const { line1, line2 } = splitNavLabel(item.label);
                    return (
                      <Link
                        key={`${item.href}-${item.label}`}
                        href={item.href}
                        title={item.label}
                        className={`relative flex items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-[13px] font-semibold leading-[1.2] transition-[color,background-color,box-shadow,border-color] ${
                          active
                            ? "border-l-ds-success bg-[color-mix(in_srgb,var(--ds-success)_14%,var(--ds-sidebar))] text-ds-foreground shadow-[0_0_12px_color-mix(in_srgb,var(--ds-success)_22%,transparent)]"
                            : "border-l-transparent text-ds-muted hover:bg-[color-mix(in_srgb,var(--ds-success)_10%,var(--ds-sidebar))] hover:text-ds-foreground"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                            active
                              ? "bg-ds-primary text-ds-success shadow-sm ring-1 ring-[color-mix(in_srgb,var(--ds-success)_35%,transparent)]"
                              : "bg-ds-secondary text-ds-muted"
                          }`}
                        >
                          <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 overflow-hidden text-left">
                          <span className="block truncate">{line1}</span>
                          {line2 ? <span className="mt-0.5 block truncate text-[12px] opacity-90">{line2}</span> : null}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
