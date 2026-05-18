/**
 * Domain-based navigation tree — presentation layer only.
 *
 * Flow:
 *   resolveAuthorizedNavItems(session)  — existing matrix + RBAC pipeline
 *   → attachRegistryMetadata()
 *   → groupIntoDomains()
 *
 * Sidebar consumers call {@link buildNavigationTree}; they must NOT re-run permission checks.
 */
import {
  dashboardNavGroupSortIndex,
  type DashboardScope,
} from "@/config/platform/dashboard-scope";
import { getMasterFeatureByKey } from "@/config/platform/master-feature-registry";
import {
  NAV_DOMAIN_META,
  NAV_DOMAIN_ORDER,
  type NavDomain,
} from "@/config/platform/nav-domains";
import type { MasterFeatureIcon } from "@/config/platform/master-feature-registry";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { tenantSidebarNavItemsForLiveApp } from "@/lib/rbac/session-access";
import type { TenantSidebarNavItem } from "@/lib/rbac/tenant-nav";

export type NavigationTreeItem = {
  key: string;
  href: string;
  label: string;
  icon: MasterFeatureIcon;
  navDomain: NavDomain;
  navGroup: string;
  navOrder: number;
  dashboardScope?: DashboardScope;
  ownershipDepartment?: string;
};

export type NavigationTreeGroup = {
  group: string;
  items: NavigationTreeItem[];
};

export type NavigationTreeDomain = {
  domain: NavDomain;
  label: string;
  icon: MasterFeatureIcon;
  groups: NavigationTreeGroup[];
};

const DEFAULT_NAV_GROUP = "General";

/**
 * Authorized sidebar rows for the live app (registry visibility ∩ classic route gate; no Settings).
 * This is the single authorization boundary for navigation — do not duplicate checks in UI.
 */
export function resolveAuthorizedNavItems(session: PulseAuthSession | null): TenantSidebarNavItem[] {
  return tenantSidebarNavItemsForLiveApp(session);
}

function presentationOrder(item: TenantSidebarNavItem & { navOrder: number }): number {
  return item.navOrder;
}

/** Attach registry presentation metadata — never affects visibility. */
export function attachRegistryMetadata(
  items: readonly TenantSidebarNavItem[],
): NavigationTreeItem[] {
  return items.map((row) => {
    const def = getMasterFeatureByKey(row.key);
    const navDomain = def?.navDomain ?? "Operations";
    const navGroup = def?.navGroup?.trim() || DEFAULT_NAV_GROUP;
    const navOrder = def?.navOrder ?? def?.sortOrder ?? 0;
    const label = def?.navLabelOverride?.trim() || row.label;
    return {
      key: row.key,
      href: row.href,
      label,
      icon: row.icon,
      navDomain,
      navGroup,
      navOrder,
      dashboardScope: def?.dashboardScope ?? row.dashboardScope,
      ownershipDepartment: def?.ownershipDepartment ?? row.ownershipDepartment,
    };
  });
}

function groupIntoDomains(items: readonly NavigationTreeItem[]): NavigationTreeDomain[] {
  const byDomain = new Map<NavDomain, NavigationTreeItem[]>();
  for (const item of items) {
    const list = byDomain.get(item.navDomain);
    if (list) list.push(item);
    else byDomain.set(item.navDomain, [item]);
  }

  const domains: NavigationTreeDomain[] = [];
  for (const domain of NAV_DOMAIN_ORDER) {
    const domainItems = byDomain.get(domain);
    if (!domainItems?.length) continue;

    const byGroup = new Map<string, NavigationTreeItem[]>();
    for (const item of domainItems) {
      const list = byGroup.get(item.navGroup);
      if (list) list.push(item);
      else byGroup.set(item.navGroup, [item]);
    }

    const groupNames = [...byGroup.keys()].sort((a, b) => {
      if (domain === "Dashboards") {
        const diff = dashboardNavGroupSortIndex(a) - dashboardNavGroupSortIndex(b);
        if (diff !== 0) return diff;
      }
      const minOrder = (name: string) =>
        Math.min(...(byGroup.get(name) ?? []).map((i) => i.navOrder));
      const diff = minOrder(a) - minOrder(b);
      return diff !== 0 ? diff : a.localeCompare(b);
    });

    const groups: NavigationTreeGroup[] = groupNames.map((group) => ({
      group,
      items: [...(byGroup.get(group) ?? [])].sort(
        (a, b) => presentationOrder(a) - presentationOrder(b) || a.label.localeCompare(b.label),
      ),
    }));

    const meta = NAV_DOMAIN_META[domain];
    domains.push({
      domain,
      label: meta.label,
      icon: meta.icon,
      groups,
    });
  }

  return domains;
}

/** Build domain → group → feature tree for sidebar flyouts (presentation only). */
export function buildNavigationTree(session: PulseAuthSession | null): NavigationTreeDomain[] {
  const authorized = resolveAuthorizedNavItems(session);
  const enriched = attachRegistryMetadata(authorized);
  return groupIntoDomains(enriched);
}

/** Flatten tree for debug tools and tests. */
export function flattenNavigationTree(tree: readonly NavigationTreeDomain[]): NavigationTreeItem[] {
  return tree.flatMap((d) => d.groups.flatMap((g) => g.items));
}
