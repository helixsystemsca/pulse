import { describe, expect, it } from "vitest";
import {
  buildFeaturePageTour,
  featurePageTourId,
  findNavItemForPathname,
} from "@/lib/onboarding/build-feature-page-tour";
import type { NavigationTreeDomain } from "@/lib/navigation/build-navigation-tree";

const TREE: NavigationTreeDomain[] = [
  {
    domain: "Planning",
    label: "Planning",
    icon: "calendar",
    groups: [
      {
        group: "Projects",
        items: [
          {
            key: "projects",
            href: "/projects",
            label: "Projects",
            icon: "folder-kanban",
            navDomain: "Planning",
            navGroup: "Projects",
            navOrder: 10,
          },
        ],
      },
    ],
  },
];

describe("buildFeaturePageTour", () => {
  it("builds in-page steps for a nav item", () => {
    const item = TREE[0]!.groups[0]!.items[0]!;
    const tour = buildFeaturePageTour(item);
    expect(tour.id).toBe(featurePageTourId("projects"));
    expect(tour.steps.map((s) => s.target)).toEqual([
      '[data-tour="feature-toolbar"]',
      '[data-tour="feature-workspace"]',
    ]);
    expect(tour.steps.some((s) => s.target === '[data-tour="feature-header"]')).toBe(false);
  });

  it("resolves nested paths with pathPrefix", () => {
    const item = findNavItemForPathname(TREE, "/projects/abc-123");
    expect(item?.key).toBe("projects");
  });

  it("builds inventory-specific in-page steps", () => {
    const tour = buildFeaturePageTour({
      key: "inventory",
      href: "/dashboard/inventory",
      label: "Inventory",
      icon: "package",
      navDomain: "Operations",
      navGroup: "Inventory",
      navOrder: 10,
    });
    expect(tour.id).toBe(featurePageTourId("inventory"));
    expect(tour.steps.map((s) => s.target)).toEqual([
      '[data-tour="inventory-tour-tabs"]',
      '[data-tour="inventory-tour-filters"]',
      '[data-tour="inventory-tour-list"]',
      '[data-tour="inventory-tour-create"]',
    ]);
  });
});
