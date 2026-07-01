/**
 * @deprecated Prefer `@/lib/team-management/navigation` — legacy section metadata for hub cards.
 */
import type { MasterFeatureIcon } from "@/config/platform/master-feature-registry";
import { TEAM_MANAGEMENT_NAV } from "@/lib/team-management/navigation";

export type TeamManagementSectionId = (typeof TEAM_MANAGEMENT_NAV)[number]["id"];

export type TeamManagementSectionMeta = {
  id: TeamManagementSectionId;
  slug: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: MasterFeatureIcon;
  href: string;
};

const ICON_BY_SECTION: Record<TeamManagementSectionId, MasterFeatureIcon> = {
  overview: "users",
  people: "users",
  performance: "activity",
  growth: "list-checks",
  planning: "clipboard",
  meetings: "clipboard",
};

export const TEAM_MANAGEMENT_SECTIONS: readonly TeamManagementSectionMeta[] = TEAM_MANAGEMENT_NAV.map(
  (item) => ({
    id: item.id,
    slug: item.id,
    label: item.label,
    shortLabel: item.shortLabel,
    description: item.description,
    icon: ICON_BY_SECTION[item.id],
    href: item.href,
  }),
);

export function teamManagementSectionBySlug(slug: string): TeamManagementSectionMeta | undefined {
  return TEAM_MANAGEMENT_SECTIONS.find((s) => s.slug === slug);
}

export { TEAM_MANAGEMENT_NAV, TEAM_MANAGEMENT_LEGACY_REDIRECTS } from "@/lib/team-management/navigation";
