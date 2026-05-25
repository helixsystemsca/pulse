import type { NavDomain } from "@/config/platform/nav-domains";
import type { NavigationTreeDomain } from "@/lib/navigation/build-navigation-tree";
import { buildDomainProductTour, findNavDomainForPathname } from "@/lib/onboarding/build-domain-tour";
import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { DASHBOARD_TOUR_STEPS } from "@/lib/onboarding/tour-steps/dashboard";

export type ProductTourDef = {
  id: string;
  /** Exact paths when set; domain tours match via {@link ProductTourDef.domain}. */
  paths: readonly string[];
  pathPrefix?: boolean;
  welcomeTitle: string;
  welcomeSubtitle: string;
  welcomeEmoji?: string;
  steps: TourStep[];
  /** When set, tour is offered on any authorized route in this sidebar domain. */
  domain?: NavDomain;
};

function normalizePath(path: string): string {
  const base = path.split("?")[0] ?? path;
  if (base.endsWith("/") && base.length > 1) return base.slice(0, -1);
  return base;
}

const DASHBOARD_OVERVIEW_TOUR: ProductTourDef = {
  id: "dashboard-overview",
  paths: ["/overview"],
  welcomeTitle: "Welcome to Panorama REC",
  welcomeSubtitle:
    "Let's tour your leadership dashboard—widgets, workforce, monitoring, and navigation.",
  steps: DASHBOARD_TOUR_STEPS,
};

const DASHBOARD_WORKER_TOUR: ProductTourDef = {
  id: "dashboard-worker",
  paths: ["/worker"],
  welcomeTitle: "Operations dashboard",
  welcomeSubtitle:
    "Your personal operations view uses the same widgets—here's how to read the floor at a glance.",
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

const STATIC_TOURS: readonly ProductTourDef[] = [DASHBOARD_OVERVIEW_TOUR, DASHBOARD_WORKER_TOUR];

export function resolveProductTour(
  pathname: string,
  navigationTree: readonly NavigationTreeDomain[],
): ProductTourDef | null {
  const normalized = normalizePath(pathname);

  for (const tour of STATIC_TOURS) {
    if (pathMatchesStaticTour(normalized, tour)) return tour;
  }

  const navDomain = findNavDomainForPathname(navigationTree, normalized);
  if (!navDomain) return null;

  const domainNode = navigationTree.find((d) => d.domain === navDomain);
  if (!domainNode) return null;

  return buildDomainProductTour(domainNode);
}

export function hasProductTour(
  pathname: string,
  navigationTree: readonly NavigationTreeDomain[],
): boolean {
  return resolveProductTour(pathname, navigationTree) != null;
}
