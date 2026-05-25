import type { NavDomain } from "@/config/platform/nav-domains";
import type { NavigationTreeDomain } from "@/lib/navigation/build-navigation-tree";
import { isPulseNavActive } from "@/lib/pulse-nav-active";

/** Which sidebar domain contains the current route (used for analytics / future hooks). */
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
