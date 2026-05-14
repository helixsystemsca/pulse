/**
 * @deprecated Use `config/platform/master-feature-registry` (`MASTER_FEATURES`).
 * Thin re-exports for incremental migration.
 */
export {
  MASTER_FEATURES as TENANT_NAV_MODULES,
  getMasterFeatureByKey as getTenantNavModuleByKey,
  getMasterFeatureByRoute as getTenantNavModuleByHref,
  type MasterFeatureDef as TenantNavModuleDef,
  type MasterFeatureIcon as TenantNavIcon,
} from "@/config/platform/master-feature-registry";
