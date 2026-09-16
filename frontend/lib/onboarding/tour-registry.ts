import type { NavigationTreeDomain, NavigationTreeItem } from "@/lib/navigation/build-navigation-tree";
import { findNavItemForPathname, buildFeaturePageTour } from "@/lib/onboarding/build-feature-page-tour";
import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { DASHBOARD_TOUR_STEPS } from "@/lib/onboarding/tour-steps/dashboard";
import { getMasterFeatureForPath, masterFeatureNavLabel } from "@/config/platform/master-feature-registry";
import { CUSTOM_FEATURE_TOUR_STEPS } from "@/lib/onboarding/feature-page-tour-steps";

export type ProductTourDef = {
  id: string;
  /** Route prefix or exact path; feature tours set {@link buildFeaturePageTour} href + pathPrefix. */
  paths: readonly string[];
  pathPrefix?: boolean;
  welcomeTitle: string;
  welcomeSubtitle: string;
  welcomeEmoji?: string;
  /** Centered checkmark + “You're all set!” after Finish (dashboard tours only). */
  showCompletionScreen?: boolean;
  steps: TourStep[];
};

function normalizePath(path: string): string {
  const base = path.split("?")[0] ?? path;
  if (base.endsWith("/") && base.length > 1) return base.slice(0, -1);
  return base;
}

const DASHBOARD_OVERVIEW_TOUR: ProductTourDef = {
  id: "dashboard-overview-walkthrough",
  paths: ["/overview"],
  welcomeTitle: "Leadership dashboard",
  welcomeSubtitle: "We'll highlight Ask/Search, then each live widget on this board.",
  showCompletionScreen: true,
  steps: DASHBOARD_TOUR_STEPS,
};

const DASHBOARD_WORKER_TOUR: ProductTourDef = {
  id: "dashboard-worker-walkthrough",
  paths: ["/worker"],
  welcomeTitle: "Operations dashboard",
  welcomeSubtitle: "Same widgets as leadership — we'll spotlight each control that is on your board.",
  showCompletionScreen: true,
  steps: DASHBOARD_TOUR_STEPS,
};

function pathMatchesStaticTour(pathname: string, tour: ProductTourDef): boolean {
  const normalized = normalizePath(pathname);
  for (const p of tour.paths) {
    if (tour.pathPrefix) {
      if (normalized === p || normalized.startsWith(`${p}/`)) return true;
    } else if (normalized === p) {
      return true;
    }
  }
  return false;
}

function registryFeatureAsNavItem(pathname: string): NavigationTreeItem | null {
  const def = getMasterFeatureForPath(pathname);
  if (!def || !CUSTOM_FEATURE_TOUR_STEPS[def.key]) return null;
  return {
    key: def.key,
    href: def.route.split("?")[0] ?? def.route,
    label: masterFeatureNavLabel(def),
    icon: def.icon,
    navDomain: def.navDomain,
    navGroup: def.navGroup ?? "General",
    navOrder: def.navOrder ?? def.sortOrder,
  };
}

const STATIC_TOURS: readonly ProductTourDef[] = [DASHBOARD_OVERVIEW_TOUR, DASHBOARD_WORKER_TOUR];

export function resolveProductTour(
  pathname: string,
  navigationTree: readonly NavigationTreeDomain[],
): ProductTourDef | null {
  const normalized = normalizePath(pathname);

  for (const tour of STATIC_TOURS) {
    if (pathMatchesStaticTour(normalized, tour)) return tour;
  }

  const isProcedureLibrary =
    normalized === "/training/learning/library" || normalized.startsWith("/training/learning/library/");
  if (isProcedureLibrary) {
    const navItem = findNavItemForPathname(navigationTree, normalized);
    return buildFeaturePageTour({
      key: "procedures",
      href: "/training/learning/library",
      label: "Procedures",
      icon: navItem?.icon ?? "list-checks",
      navDomain: navItem?.navDomain ?? "Training",
      navGroup: navItem?.navGroup ?? "Learning",
      navOrder: navItem?.navOrder ?? 0,
    });
  }

  const hiddenTabItem = registryFeatureAsNavItem(normalized);
  if (hiddenTabItem) return buildFeaturePageTour(hiddenTabItem);

  const navItem = findNavItemForPathname(navigationTree, normalized);
  if (!navItem) return null;

  return buildFeaturePageTour(navItem);
}

export function hasProductTour(
  pathname: string,
  navigationTree: readonly NavigationTreeDomain[],
): boolean {
  return resolveProductTour(pathname, navigationTree) != null;
}
