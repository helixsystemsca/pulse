/**
 * Role helpers for JWT/session (multi-role aware). Backend uses same precedence for `role` claim.
 */
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

/** User-facing role title (headers, Workers UI, compliance tables). */
export function humanizeRole(role: string): string {
  const key = role.trim().toLowerCase();
  if (key === "worker") return "Operations";
  if (key === "company_admin") return "Operations / Admin";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Sidebar / profile: uses server-provided label for facility tenant admins when present. */
export function sessionRoleDisplayLabel(
  session: Pick<PulseAuthSession, "role_display_label" | "role" | "roles"> | null | undefined,
): string {
  if (!session) return "Member";
  const d = session.role_display_label?.trim();
  if (d) return d;
  return humanizeRole(sessionPrimaryRole(session));
}

const DISPLAY_ORDER = ["company_admin", "manager", "supervisor", "lead", "worker", "demo_viewer"];

export function sortRolesForDisplay(roles: string[]): string[] {
  return [...roles].sort((a, b) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b));
}

export function primaryWorkerGroupKey(
  p: Pick<{ roles?: string[]; role?: string }, "roles" | "role">,
): (typeof DISPLAY_ORDER)[number] | "worker" {
  const raw = roleListFromPrincipal(p);
  // `company_admin` is permission-tier, not facility org chart. If the person also has a facility
  // role (manager/supervisor/lead/worker), group by that role instead of listing them under Admins.
  const facilityRoles = raw.filter((r) => r !== "company_admin" && r !== "system_admin");
  const forGroup = facilityRoles.length ? facilityRoles : raw;
  const prim = sessionPrimaryRole({ roles: forGroup });
  if (DISPLAY_ORDER.includes(prim as (typeof DISPLAY_ORDER)[number])) {
    return prim as (typeof DISPLAY_ORDER)[number];
  }
  return "worker";
}
