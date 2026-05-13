/**
 * Shared types for the multi-department platform layer (Phase 1 scaffold).
 * Departments consume modules; modules are not owned by a single department.
 */

export type DepartmentId = string;

/** Lucide icon name subset mapped in `PlatformAppSideNav` (extend as needed). */
export type PlatformIconKey =
  | "wrench"
  | "megaphone"
  | "waves"
  | "dumbbell"
  | "building"
  | "clipboard"
  | "scroll-text"
  | "package"
  | "book-open"
  | "bar-chart-2"
  | "message-square"
  | "newspaper"
  | "image"
  | "calendar"
  | "layout"
  | "file-text"
  | "layout-grid";

export type Department = {
  id: DepartmentId;
  slug: string;
  name: string;
  icon?: PlatformIconKey;
  /** Optional CSS color token or hex for future chrome theming. */
  accentColor?: string;
  /** Module ids enabled for this department in the org (config-driven, not UI-hardcoded). */
  enabledModuleIds: readonly string[];
};

export type PlatformModule = {
  id: string;
  slug: string;
  name: string;
  icon?: PlatformIconKey;
  /** URL segment after `/${department.slug}/`. */
  route: string;
  /** Departments that may surface this module in nav (intersected with `Department.enabledModuleIds`). */
  allowedDepartmentSlugs: readonly string[];
  requiredCapabilities?: readonly string[];
  /**
   * When set, this workspace entry forwards to existing Pulse product routes (non-breaking Phase 1).
   */
  canonicalPulseHref?: string;
  /** If set with `canonicalPulseHref`, do not redirect for these department slugs (show in-app placeholder instead). */
  suppressCanonicalForDepartments?: readonly string[];
};

export type PlatformNavItem = {
  href: string;
  label: string;
  icon: PlatformIconKey;
  /** Optional grouping for future nested nav. */
  group?: string;
};
