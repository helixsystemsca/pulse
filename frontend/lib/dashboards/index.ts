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
  resolvePostLoginLandingPath,
  writePersonalDashboardHomepageOverride,
  type DashboardHomepagePreference,
} from "@/lib/dashboards/homepage";
export {
  KIOSK_AUTO_REFRESH_MS,
  KIOSK_PAGE_DWELL_MS,
  KIOSK_PRESENTATION_CLASS,
  kioskPageDwellMs,
  kioskPageOffsets,
  kioskRefreshIntervalMs,
} from "@/lib/dashboards/kiosk";
