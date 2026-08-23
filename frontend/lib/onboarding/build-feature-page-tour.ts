import type { NavigationTreeDomain, NavigationTreeItem } from "@/lib/navigation/build-navigation-tree";
import { isPulseNavActive } from "@/lib/pulse-nav-active";
import { featurePageTourCopy } from "@/lib/onboarding/feature-page-tour-copy";
import type { ProductTourDef } from "@/lib/onboarding/tour-registry";
import {
  CUSTOM_FEATURE_TOUR_STEPS,
  customFeatureTourId,
} from "@/lib/onboarding/feature-page-tour-steps";
import { standardFeatureTourSteps } from "@/lib/onboarding/tour-steps/shared";

/** Tour ids for per-page feature walkthroughs (not domain flyout recaps). */
export function featurePageTourId(featureKey: string): string {
  return `feature-${featureKey}`;
}

const DASHBOARD_FEATURE_KEYS = new Set(["dashboard", "dashboard_worker", "dashboard_project"]);

export function isFeaturePageTourCandidate(item: NavigationTreeItem): boolean {
  return !DASHBOARD_FEATURE_KEYS.has(item.key);
}

export function buildFeaturePageTour(item: NavigationTreeItem): ProductTourDef {
  const copy = featurePageTourCopy(item.key, item.label);
  const customSteps = CUSTOM_FEATURE_TOUR_STEPS[item.key];
  const steps =
    customSteps ??
    standardFeatureTourSteps(item.label, {
      headerDescription: copy.headerDescription,
      actionsDescription: copy.actionsDescription,
      workspaceDescription: copy.workspaceDescription,
      toolbarDescription: copy.toolbarDescription,
      includeToolbar: copy.includeToolbar,
    });

  return {
    id: customFeatureTourId(item.key, featurePageTourId(item.key)),
    paths: [item.href],
    pathPrefix: true,
    welcomeTitle: item.label,
    welcomeSubtitle:
      copy.welcomeSubtitle ??
      `We'll walk through each control on ${item.label}—not the whole page in one step.`,
    steps,
  };
}

/** Longest matching nav href wins (e.g. `/projects` over `/` for nested routes). */
export function findNavItemForPathname(
  tree: readonly NavigationTreeDomain[],
  pathname: string,
): NavigationTreeItem | null {
  let best: NavigationTreeItem | null = null;
  let bestLen = -1;
  for (const domain of tree) {
    for (const group of domain.groups) {
      for (const item of group.items) {
        if (!isPulseNavActive(item.href, pathname)) continue;
        if (!isFeaturePageTourCandidate(item)) continue;
        const len = item.href.length;
        if (len > bestLen) {
          bestLen = len;
          best = item;
        }
      }
    }
  }
  return best;
}
