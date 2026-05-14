/**
 * Registry for scoped department routes (`/{dept}/{route}`).
 * Visibility: `contract_features` ∩ `rbac_permissions` only (see `buildDepartmentNavItems` and `AppSideNav`).
 */
import type { PlatformIconKey } from "@/config/platform/types";

export type PlatformWorkspaceModuleDef = {
  id: string;
  route: string;
  name: string;
  icon: PlatformIconKey;
  /** Department slugs where this module may appear (organizational routing only). */
  departmentSlugs: readonly string[];
  /** Must be present in `/auth/me` `contract_features` (company module / contract key). */
  requiredCompanyModule: string;
  /** Must be present in `/auth/me` `rbac_permissions` (or `*`). */
  requiredRbacPermission: string;
};

export const PLATFORM_WORKSPACE_MODULES: readonly PlatformWorkspaceModuleDef[] = [
  {
    id: "mod_work_orders",
    route: "work-orders",
    name: "Work Orders",
    icon: "clipboard",
    departmentSlugs: ["maintenance"],
    requiredCompanyModule: "work_requests",
    requiredRbacPermission: "work_requests.view",
  },
  {
    id: "mod_inspections",
    route: "inspections",
    name: "Inspections",
    icon: "scroll-text",
    departmentSlugs: ["maintenance"],
    requiredCompanyModule: "compliance",
    requiredRbacPermission: "compliance.view",
  },
  {
    id: "mod_equipment",
    route: "equipment",
    name: "Equipment",
    icon: "package",
    departmentSlugs: ["maintenance"],
    requiredCompanyModule: "equipment",
    requiredRbacPermission: "equipment.view",
  },
  {
    id: "mod_advertising_mapper",
    route: "advertising-mapper",
    name: "Arena Advertising",
    icon: "layout-grid",
    departmentSlugs: ["communications"],
    requiredCompanyModule: "comms_advertising_mapper",
    requiredRbacPermission: "arena_advertising.view",
  },
  {
    id: "mod_publication_builder",
    route: "publication-builder",
    name: "Publication pipeline",
    icon: "newspaper",
    departmentSlugs: ["communications"],
    requiredCompanyModule: "comms_publication_builder",
    requiredRbacPermission: "publication_pipeline.view",
  },
  {
    id: "mod_indesign_pipeline",
    route: "indesign-pipeline",
    name: "Xplor → InDesign",
    icon: "file-text",
    departmentSlugs: ["communications"],
    requiredCompanyModule: "comms_indesign_pipeline",
    requiredRbacPermission: "xplor_indesign.view",
  },
  {
    id: "mod_campaign_planner",
    route: "campaign-planner",
    name: "Social Planner",
    icon: "calendar",
    departmentSlugs: ["communications"],
    requiredCompanyModule: "comms_campaign_planner",
    requiredRbacPermission: "social_planner.view",
  },
  {
    id: "mod_assets",
    route: "assets",
    name: "Assets",
    icon: "image",
    departmentSlugs: ["communications"],
    requiredCompanyModule: "comms_assets",
    requiredRbacPermission: "communications_assets.view",
  },
  {
    id: "mod_procedures",
    route: "procedures",
    name: "Procedures",
    icon: "book-open",
    departmentSlugs: ["maintenance", "reception", "communications", "aquatics", "fitness", "racquets", "admin"],
    requiredCompanyModule: "procedures",
    requiredRbacPermission: "procedures.view",
  },
  {
    id: "mod_analytics",
    route: "analytics",
    name: "Analytics",
    icon: "bar-chart-2",
    departmentSlugs: ["maintenance", "reception", "communications", "aquatics", "fitness", "racquets", "admin"],
    requiredCompanyModule: "team_insights",
    requiredRbacPermission: "team_insights.view",
  },
  {
    id: "mod_messaging",
    route: "messaging",
    name: "Messaging",
    icon: "message-square",
    departmentSlugs: ["maintenance", "reception", "communications", "aquatics", "fitness", "racquets", "admin"],
    requiredCompanyModule: "messaging",
    requiredRbacPermission: "messaging.view",
  },
  {
    id: "mod_scheduling",
    route: "scheduling",
    name: "Scheduling",
    icon: "calendar",
    departmentSlugs: ["aquatics"],
    requiredCompanyModule: "schedule",
    requiredRbacPermission: "schedule.view",
  },
  {
    id: "mod_classes",
    route: "classes",
    name: "Classes",
    icon: "layout",
    departmentSlugs: ["fitness", "racquets"],
    requiredCompanyModule: "schedule",
    requiredRbacPermission: "schedule.view",
  },
] as const;
