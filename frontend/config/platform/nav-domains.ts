/**
 * Presentation-only navigation domains for the tenant sidebar.
 *
 * NEVER use `NavDomain` or domain labels for RBAC, contracts, route guards, or feature visibility.
 * Authorization flows exclusively through the universal permission matrix → session envelope.
 *
 * Department workflow domains mirror org names (Maintenance uses `Operations` historically).
 */
import type { MasterFeatureIcon } from "@/config/platform/master-feature-registry";

export const NAV_DOMAINS = [
  "Dashboards",
  "Planning",
  "Operations",
  "Communications",
  "Aquatics",
  "Reception",
  "Fitness",
  "Racquets",
  "Standards",
  "Team Management",
  "Assets",
  "Visuals",
  "Administration",
] as const;

export type NavDomain = (typeof NAV_DOMAINS)[number];

/** Stable display order for top-level sidebar domains. */
export const NAV_DOMAIN_ORDER: readonly NavDomain[] = NAV_DOMAINS;

export type NavDomainMeta = {
  domain: NavDomain;
  label: NavDomain;
  /** Lucide key shared with master feature icons / AppSideNav rail map. */
  icon: MasterFeatureIcon;
};

export const NAV_DOMAIN_META: Record<NavDomain, NavDomainMeta> = {
  Dashboards: { domain: "Dashboards", label: "Dashboards", icon: "layout" },
  Planning: { domain: "Planning", label: "Planning", icon: "calendar" },
  Operations: { domain: "Operations", label: "Operations", icon: "clipboard" },
  Communications: { domain: "Communications", label: "Communications", icon: "megaphone" },
  Aquatics: { domain: "Aquatics", label: "Aquatics", icon: "waves" },
  Reception: { domain: "Reception", label: "Reception", icon: "building" },
  Fitness: { domain: "Fitness", label: "Fitness", icon: "dumbbell" },
  Racquets: { domain: "Racquets", label: "Racquets", icon: "scroll-text" },
  Standards: { domain: "Standards", label: "Standards", icon: "list-checks" },
  "Team Management": { domain: "Team Management", label: "Team Management", icon: "users" },
  Assets: { domain: "Assets", label: "Assets", icon: "package" },
  Visuals: { domain: "Visuals", label: "Visuals", icon: "layers" },
  Administration: { domain: "Administration", label: "Administration", icon: "user-cog" },
};

export function isNavDomain(value: string): value is NavDomain {
  return (NAV_DOMAINS as readonly string[]).includes(value);
}

export function navDomainSortIndex(domain: NavDomain): number {
  return NAV_DOMAIN_ORDER.indexOf(domain);
}
