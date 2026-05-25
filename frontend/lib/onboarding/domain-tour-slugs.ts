import type { NavDomain } from "@/config/platform/nav-domains";

/** Stable `data-tour` token for domain rail buttons and tour ids. */
export function navDomainTourSlug(domain: NavDomain): string {
  return domain.replace(/\s+/g, "-");
}

export function domainTourId(domain: NavDomain): string {
  return `domain-${navDomainTourSlug(domain)}`;
}

export function domainRailTourTarget(domain: NavDomain): string {
  return `[data-tour="domain-rail-${navDomainTourSlug(domain)}"]`;
}

export function flyoutItemTourTarget(featureKey: string): string {
  return `[data-tour="flyout-item-${featureKey}"]`;
}
