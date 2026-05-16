/**
 * Client + server RBAC resolution audit (admin).
 * Enable verbose sidebar logs: localStorage.setItem('pulse_rbac_debug', '1')
 */
import { apiFetch } from "@/lib/api";
import { MASTER_FEATURES, NAV_VISIBLE_MASTER_FEATURES } from "@/config/platform/master-feature-registry";
import { buildDepartmentNavItems } from "@/config/platform/navigation";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { canAccessClassicNavHref, hasRbacPermission } from "@/lib/rbac/session-access";
import { explainMasterFeatureVisibility, tenantSidebarNavItemsForSession } from "@/lib/rbac/tenant-nav";
import { resolveCapabilitiesFromSession, sessionHasCapability } from "@/config/platform/permissions";

export type FeatureResolutionLogEntry = {
  feature_key: string;
  registry_key?: string | null;
  route?: string | null;
  rbac_keys_required: string[];
  sidebar_visible: boolean;
  route_allowed: boolean;
  api_allowed: boolean | null;
  render_allowed: boolean;
  failure_reason?: string | null;
  resolution_notes?: string[];
};

export type ResolvedAccessAudit = {
  user_id: string;
  company_id: string | null;
  department_slug: string | null;
  assigned_roles: string[];
  department_roles: string[];
  org_roles: string[];
  merged_capabilities: string[];
  legacy_platform_capabilities: string[];
  visible_features: string[];
  denied_features: string[];
  active_department: string | null;
  workspace_context: Record<string, unknown>;
  feature_resolution_log: FeatureResolutionLogEntry[];
  access_debug: Record<string, unknown>;
  feature_resolution_notes?: string[];
};

export async function debugResolvedAccess(
  userId: string,
  departmentSlug?: string,
): Promise<ResolvedAccessAudit> {
  const q = departmentSlug ? `?department=${encodeURIComponent(departmentSlug)}` : "";
  return apiFetch<ResolvedAccessAudit>(`/api/v1/debug/access/${encodeURIComponent(userId)}/resolved${q}`);
}

/** Run client-side gates for the current session (mirrors production helpers). */
export function auditSessionAccessLocally(
  session: PulseAuthSession | null,
  departmentSlug = "communications",
): {
  department_hub_allowed: boolean;
  sidebar_rows: { key: string; label: string; visible: boolean; reason?: string }[];
  publication_builder: {
    route: string;
    route_allowed: boolean;
    sidebar_visible: boolean;
    legacy_caps: string[];
    publications_create: boolean;
  };
  feature_log: FeatureResolutionLogEntry[];
} {
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const sidebar = tenantSidebarNavItemsForSession(session);
  const deptItems = buildDepartmentNavItems(departmentSlug, session);

  const sidebar_rows = [...NAV_VISIBLE_MASTER_FEATURES]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => {
      const ex = explainMasterFeatureVisibility(session, f, isSystemAdmin);
      return { key: f.key, label: f.label, visible: ex.visible, reason: ex.reason };
    });

  const pubRoute = "/communications/publication-builder";
  const pubMaster = MASTER_FEATURES.find((f) => f.key === "comms_publication_builder");
  const pubEx = pubMaster ? explainMasterFeatureVisibility(session, pubMaster, isSystemAdmin) : null;

  const feature_log: FeatureResolutionLogEntry[] = NAV_VISIBLE_MASTER_FEATURES.map((f) => {
    const ex = explainMasterFeatureVisibility(session, f, isSystemAdmin);
    const routeOk = canAccessClassicNavHref(session, f.route);
    return {
      feature_key: f.feature,
      registry_key: f.key,
      route: f.route,
      rbac_keys_required: [...f.rbacAnyOf],
      sidebar_visible: ex.visible,
      route_allowed: routeOk,
      api_allowed: null,
      render_allowed: routeOk,
      failure_reason: ex.visible ? (routeOk ? null : "route_denied") : "sidebar_hidden",
      resolution_notes: ex.reason ? [ex.reason] : [],
    };
  });

  const legacy = resolveCapabilitiesFromSession(session);

  return {
    department_hub_allowed: false,
    sidebar_rows,
    publication_builder: {
      route: pubRoute,
      route_allowed: canAccessClassicNavHref(session, pubRoute),
      sidebar_visible: pubEx?.visible ?? false,
      legacy_caps: legacy,
      publications_create: sessionHasCapability(session, "publications.create"),
    },
    feature_log,
  };
}

export function logSidebarResolution(session: PulseAuthSession | null): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("pulse_rbac_debug") !== "1") return;

  const audit = auditSessionAccessLocally(session, "communications");
  console.group("[pulse_rbac_debug] sidebar resolution");
  console.table(
    audit.sidebar_rows.map((r) => ({
      key: r.key,
      visible: r.visible,
      reason: r.reason ?? "",
    })),
  );
  console.log("department hub (communications) allowed:", audit.department_hub_allowed);
  console.log("publication builder:", audit.publication_builder);
  console.groupEnd();
}

export function logPublicationBuilderAccess(session: PulseAuthSession | null): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("pulse_rbac_debug") !== "1") return;

  const route = "/communications/publication-builder";
  const gate = {
    component_mounted: true,
    route_guard_passed: canAccessClassicNavHref(session, route),
    workspace_hub_allowed: false,
    enabled_features: session?.enabled_features ?? [],
    rbac_permissions: session?.rbac_permissions ?? [],
    contract_features: session?.contract_features ?? [],
    publication_pipeline_rbac: hasRbacPermission(session, "publication_pipeline.view"),
    legacy_publications_create: sessionHasCapability(session, "publications.create"),
    platform_route: route,
    platform_module_redirect: "/communications/publication-builder (canonical)",
  };
  console.info("[pulse_rbac_debug] PublicationBuilder", gate);
}
