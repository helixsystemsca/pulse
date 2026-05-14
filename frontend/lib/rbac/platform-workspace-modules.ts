/**
 * @deprecated Use {@link MASTER_FEATURES} from `config/platform/master-feature-registry`.
 */
import { LEGACY_PLATFORM_ROUTE_ALIASES } from "@/config/platform/legacy-platform-routes";
import { MASTER_FEATURES } from "@/config/platform/master-feature-registry";
import type { PlatformIconKey } from "@/config/platform/types";

export type PlatformWorkspaceModuleDef = {
  id: string;
  route: string;
  name: string;
  icon: PlatformIconKey;
  departmentSlugs: readonly string[];
  requiredCompanyModule: string;
  requiredRbacPermission: string;
};

function toPlatformIcon(icon: string): PlatformIconKey {
  const allowed: PlatformIconKey[] = [
    "wrench",
    "megaphone",
    "waves",
    "dumbbell",
    "building",
    "clipboard",
    "scroll-text",
    "package",
    "book-open",
    "bar-chart-2",
    "message-square",
    "newspaper",
    "image",
    "calendar",
    "layout",
    "file-text",
    "layout-grid",
  ];
  if (allowed.includes(icon as PlatformIconKey)) return icon as PlatformIconKey;
  return "layout";
}

export const PLATFORM_WORKSPACE_MODULES: readonly PlatformWorkspaceModuleDef[] = [
  ...MASTER_FEATURES.filter((f) => f.platformRoute && f.platformDepartmentSlug).map((f) => ({
    id: f.key,
    route: f.platformRoute!,
    name: f.label,
    icon: toPlatformIcon(f.icon),
    departmentSlugs: f.departmentSlugs ?? [f.platformDepartmentSlug!],
    requiredCompanyModule: f.feature,
    requiredRbacPermission: f.rbacAnyOf[0] ?? "",
  })),
  ...LEGACY_PLATFORM_ROUTE_ALIASES.map((r) => ({
    id: r.key,
    route: r.route,
    name: r.key,
    icon: "layout" as PlatformIconKey,
    departmentSlugs: [r.departmentSlug],
    requiredCompanyModule: r.feature,
    requiredRbacPermission: r.rbacAnyOf[0] ?? "",
  })),
];
