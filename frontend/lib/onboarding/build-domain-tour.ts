import type { NavDomain } from "@/config/platform/nav-domains";
import type { NavigationTreeDomain, NavigationTreeItem } from "@/lib/navigation/build-navigation-tree";
import { isPulseNavActive } from "@/lib/pulse-nav-active";
import { flyoutItemTourDescription } from "@/lib/onboarding/flyout-item-copy";
import {
  domainRailTourTarget,
  domainTourId,
  flyoutItemTourTarget,
} from "@/lib/onboarding/domain-tour-slugs";
import type { ProductTourDef } from "@/lib/onboarding/tour-registry";
import type { TourStep } from "@/lib/onboarding/tour-steps/types";

function flattenDomainItems(domain: NavigationTreeDomain): NavigationTreeItem[] {
  return domain.groups.flatMap((g) => g.items);
}

export function buildDomainProductTour(domainNode: NavigationTreeDomain): ProductTourDef {
  const items = flattenDomainItems(domainNode);
  const steps: TourStep[] = [
    {
      target: domainRailTourTarget(domainNode.domain),
      title: `${domainNode.label} menu`,
      description:
        "This icon opens the module menu for the domain. Hover or click to keep it open while you explore each page below.",
      placement: "right",
    },
    {
      target: '[data-tour="domain-flyout"]',
      title: `${domainNode.label} modules`,
      description:
        items.length > 1
          ? `These ${items.length} pages are grouped under ${domainNode.label}. Each link opens a dedicated workspace.`
          : `This is the ${domainNode.label} workspace entry point for your role.`,
      placement: "right",
    },
    ...items.map((item) => ({
      target: flyoutItemTourTarget(item.key),
      title: item.label,
      description: flyoutItemTourDescription(item.key, item.label),
      placement: "right" as const,
    })),
  ];

  return {
    id: domainTourId(domainNode.domain),
    paths: [],
    welcomeTitle: `${domainNode.label}`,
    welcomeSubtitle: `A quick tour of every page in the ${domainNode.label} menu—what each module is for and when to use it.`,
    steps,
    domain: domainNode.domain,
  };
}

export function findNavDomainForPathname(
  tree: readonly NavigationTreeDomain[],
  pathname: string,
): NavDomain | null {
  for (const domain of tree) {
    for (const group of domain.groups) {
      for (const item of group.items) {
        if (isPulseNavActive(item.href, pathname)) return domain.domain;
      }
    }
  }
  return null;
}
