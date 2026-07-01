import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";

/** Primary Team Management navigation — manager workspace sections. */
export type TeamManagementNavId =
  | "overview"
  | "people"
  | "performance"
  | "growth"
  | "planning"
  | "meetings";

export type TeamManagementNavItem = {
  id: TeamManagementNavId;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export const TEAM_MANAGEMENT_NAV: readonly TeamManagementNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    shortLabel: "Overview",
    description: "Manager attention dashboard — health, reviews, milestones, and alerts.",
    href: "/team-management",
    icon: LayoutDashboard,
  },
  {
    id: "people",
    label: "People",
    shortLabel: "People",
    description: "Employee directory, profiles, skills, certifications, and career information.",
    href: "/team-management/people",
    icon: Users,
  },
  {
    id: "performance",
    label: "Performance",
    shortLabel: "Performance",
    description: "Team matrix, assessments, development plans, and review history.",
    href: "/team-management/performance",
    icon: TrendingUp,
  },
  {
    id: "growth",
    label: "Growth",
    shortLabel: "Growth",
    description: "Onboarding, training, mentorship, and career progression.",
    href: "/team-management/growth",
    icon: GraduationCap,
  },
  {
    id: "planning",
    label: "Planning",
    shortLabel: "Planning",
    description: "Hiring, workforce planning, capacity, and headcount.",
    href: "/team-management/planning",
    icon: ClipboardList,
  },
  {
    id: "meetings",
    label: "Meetings",
    shortLabel: "Meetings",
    description: "One-on-ones, team meetings, notes, and follow-ups.",
    href: "/team-management/meetings",
    icon: MessageSquare,
  },
] as const;

export type TeamManagementSubNavItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
  future?: boolean;
};

export const PEOPLE_SUB_NAV: readonly TeamManagementSubNavItem[] = [
  { id: "directory", label: "Directory", href: "/team-management/people" },
  { id: "skills", label: "Skills Matrix", href: "/team-management/people/skills" },
  { id: "certifications", label: "Certifications", href: "/team-management/people/certifications" },
  { id: "career-goals", label: "Career Goals", href: "/team-management/people/career-goals" },
  { id: "documents", label: "Documents", href: "/team-management/people/documents", future: true },
  { id: "emergency", label: "Emergency Contacts", href: "/team-management/people/emergency-contacts", future: true },
  { id: "org-chart", label: "Org Chart", href: "/team-management/people/org-chart", future: true },
];

export const GROWTH_SUB_NAV: readonly TeamManagementSubNavItem[] = [
  { id: "hub", label: "Overview", href: "/team-management/growth" },
  { id: "onboarding", label: "Onboarding", href: "/team-management/growth/onboarding" },
  { id: "training", label: "Training", href: "/team-management/growth/training" },
  { id: "mentorship", label: "Mentorship", href: "/team-management/growth/mentorship", future: true },
  { id: "succession", label: "Succession Planning", href: "/team-management/growth/succession", future: true },
  { id: "learning-paths", label: "Learning Paths", href: "/team-management/growth/learning-paths", future: true },
];

export const PLANNING_SUB_NAV: readonly TeamManagementSubNavItem[] = [
  { id: "hub", label: "Overview", href: "/team-management/planning" },
  { id: "hiring", label: "Hiring", href: "/team-management/planning/hiring" },
  { id: "workforce", label: "Workforce Planning", href: "/team-management/planning/workforce" },
  { id: "capacity", label: "Capacity Planning", href: "/team-management/planning/capacity", future: true },
  { id: "vacancy", label: "Vacancy Tracking", href: "/team-management/planning/vacancy", future: true },
  { id: "retirement", label: "Retirement Forecasting", href: "/team-management/planning/retirement", future: true },
  { id: "headcount", label: "Headcount", href: "/team-management/planning/headcount", future: true },
];

export const MEETINGS_SUB_NAV: readonly TeamManagementSubNavItem[] = [
  { id: "hub", label: "Overview", href: "/team-management/meetings" },
  { id: "one-on-ones", label: "One-on-Ones", href: "/team-management/meetings/one-on-ones" },
  { id: "team-meetings", label: "Team Meetings", href: "/team-management/meetings/team-meetings" },
  { id: "notes", label: "Meeting History", href: "/team-management/meetings/notes" },
  { id: "action-items", label: "Action Items", href: "/team-management/meetings/action-items" },
  { id: "follow-ups", label: "Follow-ups", href: "/team-management/meetings/follow-ups", future: true },
  { id: "coordination", label: "Coordination", href: "/team-management/meetings/coordination" },
];

/** Legacy routes → canonical routes (backwards compatibility). */
export const TEAM_MANAGEMENT_LEGACY_REDIRECTS: Readonly<Record<string, string>> = {
  "/team-management/development": "/team-management/performance",
  "/team-management/onboarding": "/team-management/growth/onboarding",
  "/team-management/hiring": "/team-management/planning/hiring",
  "/team-management/workforce-planning": "/team-management/planning/workforce",
  "/team-management/coordination": "/team-management/meetings/coordination",
  "/team-management/recognition": "/team-management",
  "/team-management/insights": "/team-management",
  "/dashboard/maintenance/analytics": "/team-management",
};

export function teamManagementNavById(id: TeamManagementNavId): TeamManagementNavItem | undefined {
  return TEAM_MANAGEMENT_NAV.find((item) => item.id === id);
}

export function isTeamManagementNavActive(href: string, pathname: string): boolean {
  if (href === "/team-management") {
    return pathname === "/team-management";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
