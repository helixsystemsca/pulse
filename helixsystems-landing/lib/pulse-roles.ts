/**
 * Role helpers for JWT/session (multi-role aware). Backend uses same precedence for `role` claim.
 */
import type { PulseAuthSession } from "@/lib/pulse-session";

const ROLE_PRECEDENCE = ["system_admin", "company_admin", "manager", "supervisor", "lead", "worker"] as const;

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

/** Any object with optional `roles` / `role` (worker row, API payload, etc.). */
export function principalHasAnyRole(
  p: { roles?: string[]; role?: string } | null | undefined,
  ...need: string[]
): boolean {
  return sessionHasAnyRole(p ?? undefined, ...need);
}

export function managerOrAbove(
  session: Pick<PulseAuthSession, "role" | "roles" | "is_system_admin"> | null | undefined,
): boolean {
  if (!session) return false;
  if (session.is_system_admin || sessionHasAnyRole(session, "system_admin")) return true;
  return sessionHasAnyRole(session, "manager", "company_admin", "supervisor");
}

/** Managers/supervisors without company_admin: limited invite/create role options. */
export function isCreateRoleLimitedSession(
  session: Pick<PulseAuthSession, "role" | "roles"> | null | undefined,
): boolean {
  if (!session) return false;
  return (
    sessionHasAnyRole(session, "manager", "supervisor") && !sessionHasAnyRole(session, "company_admin")
  );
}

export function humanizeRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const DISPLAY_ORDER = ["company_admin", "manager", "supervisor", "lead", "worker"];

export function sortRolesForDisplay(roles: string[]): string[] {
  return [...roles].sort((a, b) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b));
}

export function primaryWorkerGroupKey(
  p: Pick<{ roles?: string[]; role?: string }, "roles" | "role">,
): (typeof DISPLAY_ORDER)[number] | "worker" {
  const raw = roleListFromPrincipal(p);
  const prim = sessionPrimaryRole({ roles: raw });
  if (DISPLAY_ORDER.includes(prim as (typeof DISPLAY_ORDER)[number])) {
    return prim as (typeof DISPLAY_ORDER)[number];
  }
  return "worker";
}
