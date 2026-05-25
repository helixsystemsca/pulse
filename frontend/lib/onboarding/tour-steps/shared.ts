import type { TourStep } from "@/lib/onboarding/tour-steps/types";

export const TOUR_STEP_SIDEBAR: TourStep = {
  target: '[data-tour="sidebar-navigation"]',
  title: "Quick Navigation",
  description:
    "Use the sidebar to jump between dashboards, planning, operations, training, assets, and administration.",
  placement: "right",
};

export const TOUR_STEP_FEEDBACK: TourStep = {
  target: '[data-tour="feedback"]',
  title: "Questions or feedback?",
  description:
    "Panorama is in alpha—you may run into occasional bugs. Tap the megaphone anytime to report issues, send product feedback, or ask a question. Administrators review notes under Messages → Product feedback.",
  placement: "bottom",
};

export function standardFeatureTourSteps(
  label: string,
  options?: {
    headerDescription?: string;
    workspaceDescription?: string;
    toolbarDescription?: string;
    includeToolbar?: boolean;
  },
): TourStep[] {
  const headerDescription =
    options?.headerDescription ??
    `${label} is where your team runs this workflow. The header shows where you are and surfaces primary actions.`;
  const workspaceDescription =
    options?.workspaceDescription ??
    "This is the main work area—lists, boards, charts, and editors update here as you work.";
  const steps: TourStep[] = [
    {
      target: '[data-tour="feature-header"]',
      title: label,
      description: headerDescription,
      placement: "bottom",
    },
  ];
  if (options?.includeToolbar) {
    steps.push({
      target: '[data-tour="feature-toolbar"]',
      title: "Tools & filters",
      description:
        options.toolbarDescription ??
        "Switch views, filter data, and run common actions from this toolbar without leaving the page.",
      placement: "bottom",
    });
  }
  steps.push({
    target: '[data-tour="feature-workspace"]',
    title: "Workspace",
    description: workspaceDescription,
    placement: "top",
  });
  return steps;
}
