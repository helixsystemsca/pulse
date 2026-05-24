import type { MasterFeatureIcon } from "@/config/platform/master-feature-registry";

export type TeamManagementSectionId =
  | "insights"
  | "hiring"
  | "development"
  | "onboarding"
  | "recognition"
  | "workforce-planning"
  | "coordination";

export type TeamManagementSectionMeta = {
  id: TeamManagementSectionId;
  slug: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: MasterFeatureIcon;
  href: string;
};

export const TEAM_MANAGEMENT_SECTIONS: readonly TeamManagementSectionMeta[] = [
  {
    id: "insights",
    slug: "insights",
    label: "Team Insights",
    shortLabel: "Insights",
    description: "Workforce operational visibility — coverage, training, risks, and engagement.",
    icon: "sparkles",
    href: "/team-management/insights",
  },
  {
    id: "hiring",
    slug: "hiring",
    label: "Hiring",
    shortLabel: "Hiring",
    description: "Candidate pipeline, interviews, and onboarding readiness.",
    icon: "clipboard",
    href: "/team-management/hiring",
  },
  {
    id: "development",
    slug: "development",
    label: "Development",
    shortLabel: "Development",
    description: "Growth profiles, mentorship, and leadership readiness.",
    icon: "activity",
    href: "/team-management/development",
  },
  {
    id: "onboarding",
    slug: "onboarding",
    label: "Onboarding",
    shortLabel: "Onboarding",
    description: "Checklists, training progression, and readiness signoffs.",
    icon: "list-checks",
    href: "/team-management/onboarding",
  },
  {
    id: "recognition",
    slug: "recognition",
    label: "Recognition",
    shortLabel: "Recognition",
    description: "Milestones, certifications, and peer appreciation.",
    icon: "sparkles",
    href: "/team-management/recognition",
  },
  {
    id: "workforce-planning",
    slug: "workforce-planning",
    label: "Workforce Planning",
    shortLabel: "Planning",
    description: "Continuity, forecasting, and staffing coverage.",
    icon: "calendar",
    href: "/team-management/workforce-planning",
  },
  {
    id: "coordination",
    slug: "coordination",
    label: "Coordination",
    shortLabel: "Coordination",
    description: "Follow-ups, handoffs, and leadership action items.",
    icon: "clipboard",
    href: "/team-management/coordination",
  },
] as const;

export function teamManagementSectionBySlug(slug: string): TeamManagementSectionMeta | undefined {
  return TEAM_MANAGEMENT_SECTIONS.find((s) => s.slug === slug);
}
