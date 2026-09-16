import type { TourStep } from "@/lib/onboarding/tour-steps/types";

export const TOUR_STEP_SIDEBAR: TourStep = {
  target: '[data-tour="sidebar-navigation"]',
  title: "Sidebar",
  description:
    "Open Recreation, Codes & Guidance, Assets, Operations, and Training from here. Each item has its own walkthrough the first time you visit.",
  placement: "right",
};

export const TOUR_STEP_USER_HUB: TourStep = {
  target: '[data-tour="user-hub"]',
  title: "Ask, notifications, profile",
  description: "Ask/Search jumps to a screen. The bell is alerts. Your avatar opens profile and sign-out.",
  placement: "bottom",
};

export const TOUR_STEP_OPS_ASK: TourStep = {
  target: '[data-tour="ops-ask"]',
  title: "Ask / Search",
  description:
    "Type an ops question — “add a facility”, “assets at the arena”, “open work requests”. Results deep-link to the matching screen.",
  placement: "bottom",
};

export function standardFeatureTourSteps(
  label: string,
  options?: {
    headerDescription?: string;
    actionsDescription?: string;
    workspaceDescription?: string;
    toolbarDescription?: string;
    includeToolbar?: boolean;
  },
): TourStep[] {
  const steps: TourStep[] = [
    {
      target: '[data-tour="feature-header"]',
      title: `${label} — this screen`,
      description:
        options?.headerDescription ??
        `You are on ${label}. Title and short description say what this screen is for.`,
      placement: "bottom",
    },
    {
      target: '[data-tour="feature-actions"]',
      title: "Primary actions",
      description:
        options?.actionsDescription ??
        `Buttons on the right run the main jobs for ${label} — create, export, settings. Missing buttons are skipped.`,
      placement: "left",
    },
  ];
  if (options?.includeToolbar) {
    steps.push({
      target: '[data-tour="feature-toolbar"]',
      title: "Filters & views",
      description:
        options.toolbarDescription ??
        "Switch views and filter the list from this row without leaving the page.",
      placement: "bottom",
    });
  }
  return steps;
}
