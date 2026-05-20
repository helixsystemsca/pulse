export {
  DASHBOARD_CATALOG,
  dashboardsForNavGroup,
  dashboardsForScope,
  getDashboardCatalogEntry,
  getDashboardCatalogEntryByRoute,
  type DashboardCatalogEntry,
} from "@/lib/dashboards/catalog";
export {
  accessibleDashboardsForSession,
  readPersonalDashboardHomepageOverride,
  resolveAssignedDashboardHomepage,
  writePersonalDashboardHomepageOverride,
  type DashboardHomepagePreference,
} from "@/lib/dashboards/homepage";
export { KIOSK_AUTO_REFRESH_MS, KIOSK_PRESENTATION_CLASS, kioskRefreshIntervalMs } from "@/lib/dashboards/kiosk";
