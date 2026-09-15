import { describe, expect, it } from "vitest";
import {
  buildFeaturePageTour,
  featurePageTourId,
  findNavItemForPathname,
} from "@/lib/onboarding/build-feature-page-tour";
import { resolveProductTour } from "@/lib/onboarding/tour-registry";
import { CUSTOM_FEATURE_TOUR_STEPS } from "@/lib/onboarding/feature-page-tour-steps";
import type { NavigationTreeDomain, NavigationTreeItem } from "@/lib/navigation/build-navigation-tree";

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

function navItem(partial: Pick<NavigationTreeItem, "key" | "href" | "label">): NavigationTreeItem {
  return {
    icon: "folder-kanban",
    navDomain: "My Role",
    navGroup: "Ops",
    navOrder: 1,
    ...partial,
  };
}

describe("buildFeaturePageTour", () => {
  it("builds header/actions/toolbar steps for a generic nav item (no whole-page workspace spotlight)", () => {
    const item = TREE[0]!.groups[0]!.items[0]!;
    const tour = buildFeaturePageTour(item);
    expect(tour.id).toBe(featurePageTourId("projects"));
    expect(tour.steps.map((s) => s.target)).toEqual([
      '[data-tour="feature-header"]',
      '[data-tour="feature-actions"]',
      '[data-tour="feature-toolbar"]',
    ]);
    expect(tour.steps.map((s) => s.target)).not.toContain('[data-tour="feature-workspace"]');
  });

  it("resolves nested paths with pathPrefix", () => {
    const item = findNavItemForPathname(TREE, "/projects/abc-123");
    expect(item?.key).toBe("projects");
  });

  it("builds inventory-specific in-page steps", () => {
    const tour = buildFeaturePageTour(
      navItem({ key: "inventory", href: "/dashboard/inventory", label: "Inventory" }),
    );
    expect(tour.id).toBe("feature-inventory-walkthrough");
    expect(tour.steps.map((s) => s.target)).toEqual([
      '[data-tour="inventory-tour-tabs"]',
      '[data-tour="inventory-tour-filters"]',
      '[data-tour="inventory-tour-facility"]',
      '[data-tour="inventory-tour-list"]',
      '[data-tour="inventory-tour-create"]',
    ]);
  });

  it("builds a control-by-control walkthrough for the daily planner", () => {
    const tour = buildFeaturePageTour(
      navItem({ key: "daily_planner", href: "/planner", label: "Daily Planner" }),
    );
    expect(tour.id).toBe("feature-daily_planner-walkthrough");
    expect(tour.steps.length).toBeGreaterThan(6);
    expect(tour.steps.map((s) => s.target)).toContain('[data-tour="planner-calendar"]');
    expect(tour.welcomeSubtitle.toLowerCase()).toContain("calendar");
  });

  it.each([
    ["equipment", "/equipment", "equipment-tour-list"],
    ["ops_facilities", "/recreation/facilities", "facilities-tour-create"],
    ["work_requests", "/dashboard/maintenance", "work-requests-tour-create"],
    ["logs_inspections", "/dashboard/compliance", "inspections-tour-new-sheet"],
    ["ops_regulations", "/recreation/regulations", "regulations-tour-search"],
    ["training_overview", "/training/overview", "training-overview-kpis"],
    ["training_learning", "/training/learning", "training-learning-tab-library"],
    ["procedures", "/training/learning/library", "procedures-tour-create"],
    ["training_compliance", "/training/compliance", "training-compliance-matrix"],
    ["training_flashcards", "/training/flashcards", "training-flashcards-header"],
    ["ops_me", "/recreation/me", "ops-me-tour-tabs"],
  ] as const)("walks %s feature-by-feature with real control targets", (key, href, expectedTarget) => {
    const tour = buildFeaturePageTour(navItem({ key, href, label: key }));
    expect(tour.id).toBe(`feature-${key}-walkthrough`);
    expect(tour.steps.length).toBeGreaterThanOrEqual(3);
    expect(tour.steps.map((s) => s.target)).toContain(`[data-tour="${expectedTarget}"]`);
    expect(tour.steps.every((s) => s.target !== '[data-tour="feature-workspace"]')).toBe(true);
  });
});

describe("CUSTOM_FEATURE_TOUR_STEPS", () => {
  it("covers high-traffic Vernon modules", () => {
    expect(Object.keys(CUSTOM_FEATURE_TOUR_STEPS)).toEqual(
      expect.arrayContaining([
        "inventory",
        "equipment",
        "work_requests",
        "logs_inspections",
        "ops_regulations",
        "ops_facilities",
        "ops_me",
        "training_overview",
        "training_learning",
        "training_compliance",
        "training_flashcards",
        "procedures",
      ]),
    );
  });
});

describe("resolveProductTour", () => {
  it("uses the retargeted dashboard walkthrough (no overview modal id)", () => {
    const tour = resolveProductTour("/overview", []);
    expect(tour?.id).toBe("dashboard-overview-walkthrough");
    expect(tour?.steps.map((s) => s.target)).toContain('[data-tour="ops-ask"]');
    expect(tour?.steps.map((s) => s.title).join(" ")).not.toMatch(/Widget System/i);
  });

  it("walks the procedure library as its own control-by-control tour", () => {
    const tree: NavigationTreeDomain[] = [
      {
        domain: "Training",
        label: "Training",
        icon: "folder-kanban",
        groups: [
          {
            group: "Learning",
            items: [
              navItem({
                key: "training_learning",
                href: "/training/learning",
                label: "Learning",
              }),
            ],
          },
        ],
      },
    ];
    const tour = resolveProductTour("/training/learning/library", tree);
    expect(tour?.id).toBe("feature-procedures-walkthrough");
    expect(tour?.steps.map((s) => s.target)).toEqual([
      '[data-tour="procedures-tour-create"]',
      '[data-tour="procedures-tour-assign"]',
      '[data-tour="procedures-tour-filter"]',
      '[data-tour="procedures-tour-list"]',
    ]);
  });
});
