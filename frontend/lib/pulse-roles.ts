/**
 * Role helpers for JWT/session (multi-role aware). Backend uses same precedence for `role` claim.
 */
import { getDepartmentBySlug } from "@/config/platform/departments";
import type { PulseAuthSession } from "@/lib/pulse-session";

const ROLE_PRECEDENCE = ["system_admin", "company_admin", "manager", "supervisor", "lead", "worker", "demo_viewer"] as const;

export function roleListFromPrincipal(p: { roles?: string[]; role?: string } | null | undefined): string[] {
  if (!p) return [];
  if (p.roles?.length) return [...p.roles];
  if (p.role) return [p.role];
  return [];
}

export function sessionPrimaryRole(session: Pick<PulseAuthSession, "role" | "roles"> | null | undefined): string {
  const list = roleListFromPrincipal(session);
  if (!list.length) return "worker";
  let best = list[0]!;
  let bi = 999;
  for (const r of list) {
    const i = ROLE_PRECEDENCE.indexOf(r as (typeof ROLE_PRECEDENCE)[number]);
    const idx = i === -1 ? 999 : i;
    if (idx < bi) {
      bi = idx;
      best = r;
    }
  }
  return best;
}

export function sessionHasAnyRole(
  session: Pick<PulseAuthSession, "role" | "roles"> | null | undefined,
  ...need: string[]
): boolean {
  const set = new Set(roleListFromPrincipal(session));
  return need.some((n) => set.has(n));
}

/**
 * Header badge: temp password for **worker** accounts (e.g. created by company admin). Excludes demo viewer
 * and non-worker primaries (manager, lead, …).
 */
export function shouldShowWorkerMandatoryPasswordBadge(
  session: Pick<PulseAuthSession, "must_change_password" | "role" | "roles"> | null | undefined,
): boolean {
  if (!session?.must_change_password) return false;
  if (sessionHasAnyRole(session, "demo_viewer")) return false;
  return sessionPrimaryRole(session) === "worker";
}

/** Any object with optional `roles` / `role` (worker row, API payload, etc.). */
export function principalHasAnyRole(
  p: { roles?: string[]; role?: string } | null | undefined,
  ...need: string[]
): boolean {
  return sessionHasAnyRole(p ?? undefined, ...need);
}

export function managerOrAbove(
  session: Pick<PulseAuthSession, "role" | "roles" | "is_system_admin" | "facility_tenant_admin"> | null | undefined,
): boolean {
  if (!session) return false;
  if (session.is_system_admin || sessionHasAnyRole(session, "system_admin")) return true;
  if (session.facility_tenant_admin) return true;
  return sessionHasAnyRole(session, "manager", "company_admin", "supervisor");
}

/** Roles allowed to load the org-wide training matrix API (`GET /api/v1/training/matrix`) — matches backend `require_training_matrix_access`. */
const TRAINING_TEAM_MATRIX_ROLES = ["company_admin", "manager", "supervisor", "lead"] as const;

/**
 * Full **team** training matrix (Standards → Training): leads, supervisors, managers, company / tenant admins,
 * facility tenant admins, and system admins. Matches backend `require_training_matrix_access`.
 *
 * Accounts with **only** worker-level roles (`worker`, `demo_viewer`, etc.) without any of the roles above should
 * use the personal training view (`GET /api/workers/{self}/training`).
 */
export function trainingTeamMatrixAccess(
  session: Pick<PulseAuthSession, "role" | "roles" | "is_system_admin" | "facility_tenant_admin"> | null | undefined,
): boolean {
  if (!session) return false;
  if (session.is_system_admin || sessionHasAnyRole(session, "system_admin")) return true;
  if (session.facility_tenant_admin) return true;
  return sessionHasAnyRole(session, ...TRAINING_TEAM_MATRIX_ROLES);
}

/**
 * May PATCH training assignment matrix overrides — matches backend `require_company_admin`
 * (`company_admin` role, facility tenant delegate, or system admin).
 */
export function trainingMatrixAdminOverrideAllowed(
  session: Pick<PulseAuthSession, "role" | "roles" | "is_system_admin" | "facility_tenant_admin"> | null | undefined,
): boolean {
  if (!session) return false;
  if (session.is_system_admin || sessionHasAnyRole(session, "system_admin")) return true;
  if (sessionHasAnyRole(session, "company_admin")) return true;
  if (session.facility_tenant_admin) return true;
  return false;
}

/** @deprecated Use {@link trainingTeamMatrixAccess} — kept for existing imports. */
export const trainingStandardsLeadershipAccess = trainingTeamMatrixAccess;

/** Managers and company admins only (excludes supervisor) — matches strict compliance-flag rules. */
export function complianceManagerFlagAllowed(
  session: Pick<PulseAuthSession, "role" | "roles" | "is_system_admin" | "facility_tenant_admin"> | null | undefined,
): boolean {
  if (!session) return false;
  if (session.is_system_admin || sessionHasAnyRole(session, "system_admin")) return true;
  if (session.facility_tenant_admin) return true;
  return sessionHasAnyRole(session, "manager", "company_admin");
}

/**
 * Organization-wide configuration: Helix `/settings`, module gear modals, schedule/inventory/WR org drawers, etc.
 * Platform admins always; on tenant JWTs: `company_admin` role or in-facility `facility_tenant_admin` delegate.
 */
export function canAccessCompanyConfiguration(
  session: Pick<PulseAuthSession, "role" | "roles" | "is_system_admin" | "facility_tenant_admin"> | null | undefined,
): boolean {
  if (!session) return false;
  if (session.is_system_admin || sessionHasAnyRole(session, "system_admin")) return true;
  if (sessionHasAnyRole(session, "company_admin")) return true;
  if (session.facility_tenant_admin) return true;
  return false;
}

/** Managers/supervisors without company_admin: limited invite/create role options. */
export function isCreateRoleLimitedSession(
  session: Pick<PulseAuthSession, "role" | "roles" | "facility_tenant_admin"> | null | undefined,
): boolean {
  if (!session) return false;
  if (session.facility_tenant_admin) return false;
  return (
    sessionHasAnyRole(session, "manager", "supervisor") && !sessionHasAnyRole(session, "company_admin")
  );
}

/** User-facing role title (headers, Workers UI, compliance tables). Never use "Operations" without HR department context. */
export function humanizeRole(role: string): string {
  const key = role.trim().toLowerCase();
  if (key === "worker") return "Staff";
  if (key === "company_admin") return "Operations / Admin";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** HR `department` slug for roster grouping (aligns with Team Management invite options). */
const ROSTER_DEPT_ORDER = [
  "unset",
  "maintenance",
  "communications",
  "reception",
  "aquatics",
  "fitness",
  "racquets",
  "admin",
  "__other__",
] as const;

const ROSTER_DEPT_TITLE: Record<(typeof ROSTER_DEPT_ORDER)[number], string> = {
  unset: "Corporate",
  maintenance: "Maintenance",
  communications: "Communications",
  reception: "Reception",
  aquatics: "Aquatics",
  fitness: "Fitness",
  racquets: "Racquets",
  admin: "Administration",
  __other__: "Other departments",
};

export function rosterDepartmentSlug(
  worker: Pick<{ department?: string | null; roles?: string[]; role?: string }, "department" | "roles" | "role">,
): string {
  const raw = (worker.department ?? "").trim().toLowerCase();
  if (!raw) {
    // Off-site / IT-style company admins: no facility department slug — not part of Maintenance roster.
    const rawRoles = roleListFromPrincipal(worker);
    const hasFacilityOrgRole = rawRoles.some((r) =>
      ["manager", "supervisor", "lead", "worker"].includes(r),
    );
    if (!hasFacilityOrgRole && sessionHasAnyRole(worker, "company_admin")) {
      return "unset";
    }
    return "maintenance";
  }
  for (const k of ROSTER_DEPT_ORDER) {
    if (k === "__other__") continue;
    if (raw === k) return k;
  }
  return "__other__";
}

export function rosterDepartmentTitle(slug: string): string {
  const k = slug.trim().toLowerCase() as (typeof ROSTER_DEPT_ORDER)[number];
  return ROSTER_DEPT_TITLE[k] ?? slug;
}

/** Plural section title for the `worker` API tier under a department (Maintenance → Operations, Communications → Coordinators). */
export function rosterWorkerTierSectionTitle(departmentSlug: string): string {
  const d = departmentSlug.trim().toLowerCase();
  if (d === "unset") return "Staff";
  if (d === "maintenance") return "Operations";
  if (d === "communications" || d === "reception") return "Coordinators";
  if (d === "aquatics" || d === "fitness" || d === "racquets") return "Program staff";
  return "Staff";
}

/** Badge / cell label: `worker` role shown by HR department (API role stays `worker`). */
export function workerRoleDisplayLabel(departmentSlug: string | null | undefined, role: string): string {
  if (role !== "worker") return humanizeRole(role);
  const d = (departmentSlug ?? "").trim().toLowerCase();
  if (!d || d === "unset") return "Staff";
  if (d === "maintenance") return "Operations";
  if (d === "communications" || d === "reception") return "Coordinator";
  if (d === "aquatics" || d === "fitness" || d === "racquets") return "Program staff";
  return "Staff";
}

/** Sub-header under a department (Managers, Operations, Coordinators, …). */
export function rosterRoleSectionTitle(role: string, departmentSlug: string): string {
  const r = role.trim().toLowerCase();
  if (r === "company_admin") return "Company Admin";
  if (r === "manager") return "Managers";
  if (r === "supervisor") return "Supervisors";
  if (r === "lead") return "Leads";
  if (r === "worker") return rosterWorkerTierSectionTitle(departmentSlug);
  return humanizeRole(role);
}

export function rosterDepartmentIterateOrder(): readonly string[] {
  return ROSTER_DEPT_ORDER;
}

/** Chrome subtitle: HR team (from `/auth/me` `hr_department`) + role; no maintenance default for `worker`. */
export function sessionRoleDisplayLabel(
  session: Pick<PulseAuthSession, "role_display_label" | "role" | "roles" | "hr_department"> | null | undefined,
): string {
  if (!session) return "Member";
  const override = session.role_display_label?.trim();
  if (override) return override;

  const prim = sessionPrimaryRole(session);
  const slug = (session.hr_department ?? "").trim().toLowerCase();
  const dept = slug ? getDepartmentBySlug(slug) : undefined;
  const teamName = dept?.name ?? (slug ? rosterDepartmentTitle(slug) : "");

  if (teamName) {
    const rolePart = prim === "worker" ? workerRoleDisplayLabel(slug, "worker") : humanizeRole(prim);
    return `${teamName} · ${rolePart}`;
  }

  if (prim === "worker" || prim === "demo_viewer") {
    return prim === "demo_viewer" ? humanizeRole("demo_viewer") : workerRoleDisplayLabel(undefined, "worker");
  }
  return humanizeRole(prim);
}

const DISPLAY_ORDER = ["company_admin", "manager", "supervisor", "lead", "worker", "demo_viewer"];

/** Roster buckets in Team Management (subset of platform roles; fixed map keys in WorkersApp). */
export const ROSTER_GROUP_ROLE_KEYS = ["company_admin", "manager", "supervisor", "lead", "worker"] as const;
export type RosterGroupRoleKey = (typeof ROSTER_GROUP_ROLE_KEYS)[number];

export function sortRolesForDisplay(roles: string[]): string[] {
  return [...roles].sort((a, b) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b));
}

/**
 * Order of roster sections within a department.
 * - Administration or Corporate (no department): Company Admin first.
 * - Communications / reception: Coordinators (`worker` tier) directly under Managers; Company Admin bucket last.
 * - Other departments: ladder first, Company Admin bucket last so tenant admins on the floor are not visually above the team.
 */
export function rosterRoleGroupOrder(departmentSlug: string): RosterGroupRoleKey[] {
  const d = departmentSlug.trim().toLowerCase();
  if (d === "admin" || d === "unset") {
    return ["company_admin", "manager", "supervisor", "lead", "worker"];
  }
  if (d === "communications" || d === "reception") {
    return ["manager", "worker", "supervisor", "lead", "company_admin"];
  }
  return ["manager", "supervisor", "lead", "worker", "company_admin"];
}

export function primaryWorkerGroupKey(
  p: Pick<{ roles?: string[]; role?: string; department?: string | null }, "roles" | "role" | "department">,
): RosterGroupRoleKey {
  const raw = roleListFromPrincipal(p);
  // `company_admin` is permission-tier, not facility org chart. If the person also has a facility
  // role (manager/supervisor/lead/worker), group by that role instead of listing them under Admins.
  const facilityRoles = raw.filter((r) => r !== "company_admin" && r !== "system_admin");
  if (facilityRoles.length > 0) {
    const prim = sessionPrimaryRole({ roles: facilityRoles });
    if (ROSTER_GROUP_ROLE_KEYS.includes(prim as RosterGroupRoleKey)) {
      return prim as RosterGroupRoleKey;
    }
    return "worker";
  }

  // Only admin / system tier — no explicit manager/supervisor/lead/worker role on the account.
  // Standalone "Company Admin" roster: Administration HR dept, or corporate accounts with no facility department.
  if (sessionHasAnyRole(p, "company_admin")) {
    const dept = rosterDepartmentSlug(p);
    if (dept === "admin" || dept === "unset") return "company_admin";
    return "worker";
  }

  const prim = sessionPrimaryRole({ roles: raw });
  if (ROSTER_GROUP_ROLE_KEYS.includes(prim as RosterGroupRoleKey)) {
    return prim as RosterGroupRoleKey;
  }
  return "worker";
}
