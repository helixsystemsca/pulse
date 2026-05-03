"use client";

import Link from "next/link";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ImpersonationTenantModal } from "@/components/system/ImpersonationTenantModal";
import { Card } from "@/components/pulse/Card";
import { DataTableCard, dataTableBodyRow, dataTableHeadRowClass } from "@/components/ui/DataTable";
import { dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { apiFetch } from "@/lib/api";
import type { LoginEventRow } from "@/lib/workersService";
import { fetchSystemUserLoginEvents } from "@/lib/workersService";
import { setImpersonationOverlayAccessToken } from "@/lib/impersonation-overlay-token";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { readSession } from "@/lib/pulse-session";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  /** Highest-precedence RBAC role (same claim as JWT primary). */
  role: string;
  /** Full `users.roles` array from the database. */
  roles?: string[];
  /** True when this user id matches `companies.owner_admin_id` for their tenant. */
  is_company_owner?: boolean;
  company_id: string | null;
  company_name: string | null;
  is_active: boolean;
  can_use_pm_features: boolean;
  last_login: string | null;
  last_active_at?: string | null;
  last_login_city?: string | null;
  last_login_region?: string | null;
  last_login_user_agent?: string | null;
};

type PendingInviteRow = {
  invite_id: string;
  email: string;
  role: string;
  company_id: string;
  company_name: string | null;
  expires_at: string;
};

type CompanyMember = {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
};

type TenantOwnerModal =
  | {
      companyId: string;
      companyName: string | null;
      mode: "pick_new_owner";
      /** Current tenant owner row (must pick a different member). */
      currentOwnerRow: UserRow;
    }
  | {
      companyId: string;
      companyName: string | null;
      mode: "self_as_owner";
      /** User who will become tenant owner. */
      candidateRow: UserRow;
    };

type UsersDirectory = {
  users: UserRow[];
  pending_invites: PendingInviteRow[];
};

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All roles" },
  { value: "system_admin", label: "System admin" },
  { value: "company_admin", label: "Company admin" },
  { value: "manager", label: "Manager" },
  { value: "worker", label: "Worker" },
];

const INPUT = dsInputClass;
const BTN_PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2");
const BTN_SECONDARY = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2");

/** Role for the outgoing tenant owner after `company_admin` is removed (system transfer-tenant-owner). */
const PREVIOUS_OWNER_ROLE_OPTIONS = [
  { value: "worker" as const, label: "Worker" },
  { value: "lead" as const, label: "Lead" },
  { value: "supervisor" as const, label: "Supervisor" },
  { value: "manager" as const, label: "Manager" },
];
type PreviousOwnerRole = (typeof PREVIOUS_OWNER_ROLE_OPTIONS)[number]["value"];

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatGeo(r: UserRow): string {
  const c = r.last_login_city?.trim();
  const reg = r.last_login_region?.trim();
  if (c && reg) return `${c}, ${reg}`;
  if (c) return c;
  if (reg) return reg;
  return "—";
}

function shortenUa(ua: string | null | undefined, max = 56): string {
  const s = (ua ?? "").trim();
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default function SystemUsersPage() {
  const session = readSession();
  const myUserId = session?.sub ?? "";

  const [rows, setRows] = useState<UserRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [impersonationModal, setImpersonationModal] = useState<{
    token: string;
    email: string;
    full_name: string | null;
  } | null>(null);

  const [appliedQ, setAppliedQ] = useState("");
  const [appliedRole, setAppliedRole] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftQ, setDraftQ] = useState("");
  const [draftRole, setDraftRole] = useState("");

  const [activityOpen, setActivityOpen] = useState(false);
  const [activityTarget, setActivityTarget] = useState<UserRow | null>(null);
  const [activityRows, setActivityRows] = useState<LoginEventRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [pmBusyId, setPmBusyId] = useState<string | null>(null);

  const [tenantModal, setTenantModal] = useState<TenantOwnerModal | null>(null);
  const [tenantMembers, setTenantMembers] = useState<CompanyMember[]>([]);
  const [tenantMembersLoading, setTenantMembersLoading] = useState(false);
  const [newOwnerUserId, setNewOwnerUserId] = useState("");
  const [changePreviousOwnerTo, setChangePreviousOwnerTo] = useState<PreviousOwnerRole>("manager");
  const [tenantBusy, setTenantBusy] = useState(false);
  const [tenantErr, setTenantErr] = useState<string | null>(null);

  const openFilters = () => {
    setDraftQ(appliedQ);
    setDraftRole(appliedRole);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setAppliedQ(draftQ);
    setAppliedRole(draftRole);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setDraftQ("");
    setDraftRole("");
    setAppliedQ("");
    setAppliedRole("");
    setFilterOpen(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("limit", "200");
      if (appliedQ.trim()) sp.set("q", appliedQ.trim());
      if (appliedRole.trim()) sp.set("role", appliedRole.trim());
      const data = await apiFetch<UsersDirectory>(`/api/system/users?${sp.toString()}`);
      setRows(data.users ?? []);
      setPendingInvites(data.pending_invites ?? []);
    } catch (e: unknown) {
      setRows([]);
      setPendingInvites([]);
      setLoadError(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [appliedQ, appliedRole]);

  async function togglePmFeatures(userId: string, next: boolean) {
    setPmBusyId(userId);
    try {
      await apiFetch(`/api/system/users/${userId}/pm-features`, {
        method: "PATCH",
        json: { can_use_pm_features: next },
      });
      setRows((prev) => prev.map((r) => (r.id === userId ? { ...r, can_use_pm_features: next } : r)));
    } catch (e) {
      const { message } = parseClientApiError(e);
      setLoadError(message || "Could not update PM features.");
    } finally {
      setPmBusyId(null);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!tenantModal) {
      setTenantMembers([]);
      setTenantErr(null);
    setNewOwnerUserId("");
    setChangePreviousOwnerTo("manager");
      return;
    }
    if (tenantModal.mode === "self_as_owner") {
      setNewOwnerUserId(tenantModal.candidateRow.id);
    } else {
      setNewOwnerUserId("");
    }
    let cancelled = false;
    (async () => {
      setTenantMembersLoading(true);
      setTenantErr(null);
      try {
        const mem = await apiFetch<CompanyMember[]>(`/api/system/companies/${tenantModal.companyId}/members`);
        if (!cancelled) setTenantMembers(mem ?? []);
      } catch (e: unknown) {
        if (!cancelled) {
          setTenantMembers([]);
          setTenantErr(parseClientApiError(e).message);
        }
      } finally {
        if (!cancelled) setTenantMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantModal]);

  const filterBadge = useMemo(() => {
    let n = 0;
    if (appliedQ.trim()) n += 1;
    if (appliedRole.trim()) n += 1;
    return n;
  }, [appliedQ, appliedRole]);

  const impersonate = async (userId: string, row: UserRow) => {
    const res = await apiFetch<{ access_token: string }>(`/api/system/users/${userId}/impersonate`, {
      method: "POST",
    });
    setImpersonationOverlayAccessToken(res.access_token);
    setImpersonationModal({
      token: res.access_token,
      email: row.email,
      full_name: row.full_name,
    });
  };

  const requestReset = async (userId: string) => {
    setResetLink(null);
    const res = await apiFetch<{ reset_link_path: string }>(`/api/system/users/${userId}/reset-password`, {
      method: "POST",
    });
    setResetLink(res.reset_link_path);
  };

  const openLoginActivity = async (r: UserRow) => {
    setActivityTarget(r);
    setActivityOpen(true);
    setActivityLoading(true);
    setActivityError(null);
    setActivityRows([]);
    try {
      const evs = await fetchSystemUserLoginEvents(r.id);
      setActivityRows(evs);
    } catch (e: unknown) {
      setActivityError(parseClientApiError(e).message);
    } finally {
      setActivityLoading(false);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`Permanently delete user ${email}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/system/users/${userId}`, { method: "DELETE" });
      await load();
    } catch (e: unknown) {
      setLoadError(parseClientApiError(e).message);
    }
  };

  function openTenantOwnerModalFromRow(r: UserRow) {
    if (!r.company_id || r.role === "system_admin" || !r.is_active) return;
    if (r.is_company_owner) {
      setTenantModal({
        companyId: r.company_id,
        companyName: r.company_name,
        mode: "pick_new_owner",
        currentOwnerRow: r,
      });
    } else {
      setTenantModal({
        companyId: r.company_id,
        companyName: r.company_name,
        mode: "self_as_owner",
        candidateRow: r,
      });
    }
  }

  async function submitTenantOwnerTransfer() {
    if (!tenantModal) return;
    const companyId = tenantModal.companyId;
    const ownerId = newOwnerUserId.trim();
    if (!ownerId) {
      setTenantErr("Select the new tenant owner.");
      return;
    }
    if (tenantModal.mode === "pick_new_owner" && ownerId === tenantModal.currentOwnerRow.id) {
      setTenantErr("Choose a different user than the current owner.");
      return;
    }
    setTenantBusy(true);
    setTenantErr(null);
    try {
      await apiFetch(`/api/system/companies/${companyId}/transfer-tenant-owner`, {
        method: "POST",
        json: {
          new_owner_user_id: ownerId,
          change_previous_owner_to: changePreviousOwnerTo,
        },
      });
      setTenantModal(null);
      await load();
    } catch (e: unknown) {
      setTenantErr(parseClientApiError(e).message);
    } finally {
      setTenantBusy(false);
    }
  }

  const canManageTenantOwnership = (r: UserRow) =>
    Boolean(r.company_id && r.role !== "system_admin" && r.is_active);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ds-foreground">Users</h1>
          <p className="mt-1 text-sm text-ds-muted">
            Tenant accounts and pending invites. Impersonation opens a preview of the operations dashboard in a modal
            (your admin session stays here; close the modal to exit).
          </p>
        </div>
        <button
          type="button"
          onClick={openFilters}
          className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex items-center gap-2 px-4 py-2 text-sm")}
        >
          Filters
          {filterBadge > 0 ? (
            <span className="app-badge-emerald px-2 py-0.5 text-[11px] font-bold">{filterBadge}</span>
          ) : null}
        </button>
      </div>

      {filterOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--ds-text-primary)_38%,transparent)] p-4 backdrop-blur-sm"
          onClick={() => setFilterOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-filter-title"
            onClick={(e) => e.stopPropagation()}
          >
            <Card variant="elevated" padding="lg" className="shadow-2xl">
            <div className="flex items-center justify-between border-b border-ds-border pb-4">
              <h2 id="users-filter-title" className="text-lg font-semibold text-ds-foreground">
                Filter users
              </h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-ds-muted transition-colors hover:bg-ds-secondary hover:text-ds-foreground"
                onClick={() => setFilterOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className={`${dsLabelClass} !normal-case`} htmlFor="users-q">
                  Search
                </label>
                <input
                  id="users-q"
                  value={draftQ}
                  onChange={(e) => setDraftQ(e.target.value)}
                  placeholder="Email, name, company…"
                  className={`mt-1.5 ${INPUT}`}
                />
              </div>
              <div>
                <label className={`${dsLabelClass} !normal-case`} htmlFor="users-role">
                  Role
                </label>
                <select
                  id="users-role"
                  value={draftRole}
                  onChange={(e) => setDraftRole(e.target.value)}
                  className={`mt-1.5 ${INPUT}`}
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={() => void clearFilters()}>
                Clear
              </button>
              <button type="button" className={BTN_PRIMARY} onClick={applyFilters}>
                Apply
              </button>
            </div>
            </Card>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="ds-notification ds-notification-critical flex gap-3 px-4 py-3 text-sm text-ds-foreground">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-ds-danger" aria-hidden />
          <p className="font-medium">{loadError}</p>
        </div>
      ) : null}

      {resetLink ? (
        <div className="ds-notification ds-notification-warning flex gap-3 px-4 py-3 text-sm text-ds-foreground">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-ds-warning" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Reset link path (share securely; single-use):</p>
            <code className="mt-2 block break-all text-xs text-ds-muted">{resetLink}</code>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-ds-muted">Loading…</p>
      ) : (
        <div className="space-y-10">
          <div>
            <h2 className="text-sm font-semibold text-ds-foreground">Directory</h2>
            <p className="mt-1 text-xs text-ds-muted">
              Completed signups only. <strong className="text-ds-foreground">Delete</strong> removes the account (not
              allowed for yourself or the last system admin).
            </p>
            {rows.length === 0 ? (
              <p className="mt-3 text-sm text-ds-muted">No users match these filters.</p>
            ) : (
              <DataTableCard className="mt-3">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className={dataTableHeadRowClass}>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Role / tenant</th>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">PM Features</th>
                        <th className="px-4 py-3">Last login</th>
                        <th className="px-4 py-3">Last active</th>
                        <th className="hidden px-4 py-3 lg:table-cell">Last sign-in (geo)</th>
                        <th className="hidden px-4 py-3 xl:table-cell">Browser</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className={dataTableBodyRow(r.is_active ? "" : "opacity-50")}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-ds-foreground">{r.full_name || "—"}</div>
                            <div className="text-xs text-ds-muted">{r.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-ds-foreground">{r.role}</div>
                            {r.roles && r.roles.length > 0 ? (
                              <div className="mt-0.5 font-mono text-[10px] text-ds-muted" title="users.roles">
                                {r.roles.join(", ")}
                              </div>
                            ) : null}
                            {r.is_company_owner ? (
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="inline-flex rounded-md bg-[color-mix(in_srgb,var(--ds-success)_14%,transparent)] px-1.5 py-0.5 text-[10px] font-bold text-ds-foreground">
                                  Tenant owner
                                </span>
                                {canManageTenantOwnership(r) ? (
                                  <button
                                    type="button"
                                    className="text-[10px] font-semibold text-ds-accent underline decoration-dotted underline-offset-2 hover:brightness-110"
                                    onClick={() => openTenantOwnerModalFromRow(r)}
                                  >
                                    Transfer ownership
                                  </button>
                                ) : null}
                              </div>
                            ) : canManageTenantOwnership(r) ? (
                              <div className="mt-1">
                                <button
                                  type="button"
                                  className="text-[10px] font-semibold text-ds-accent underline decoration-dotted underline-offset-2 hover:brightness-110"
                                  onClick={() => openTenantOwnerModalFromRow(r)}
                                >
                                  Make tenant owner
                                </button>
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-ds-muted">{r.company_name || "—"}</td>
                          <td className="px-4 py-3">
                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-ds-muted">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[color-mix(in_srgb,var(--ds-success)_80%,transparent)]"
                                checked={Boolean(r.can_use_pm_features)}
                                disabled={pmBusyId === r.id}
                                onChange={(e) => void togglePmFeatures(r.id, e.target.checked)}
                                aria-label={`PM features for ${r.email}`}
                              />
                              {r.can_use_pm_features ? "On" : "Off"}
                            </label>
                          </td>
                          <td className="px-4 py-3 text-xs text-ds-muted">{r.last_login || "—"}</td>
                          <td className="px-4 py-3 text-xs text-ds-muted">{formatWhen(r.last_active_at)}</td>
                          <td className="hidden px-4 py-3 text-xs text-ds-muted lg:table-cell">{formatGeo(r)}</td>
                          <td className="hidden max-w-[12rem] px-4 py-3 text-xs text-ds-muted xl:table-cell">
                            <span title={r.last_login_user_agent ?? ""}>{shortenUa(r.last_login_user_agent)}</span>
                          </td>
                          <td className="space-x-2 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => void openLoginActivity(r)}
                              className="ds-link text-xs"
                            >
                              Login activity
                            </button>
                            {r.role !== "system_admin" && r.company_id ? (
                              <button
                                type="button"
                                onClick={() => void impersonate(r.id, r)}
                                className="ds-link text-xs"
                              >
                                Impersonate
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void requestReset(r.id)}
                              className="text-xs text-ds-muted underline decoration-dotted underline-offset-2 hover:text-ds-foreground"
                            >
                              Reset link
                            </button>
                            {r.id !== myUserId ? (
                              <button
                                type="button"
                                onClick={() => void deleteUser(r.id, r.email)}
                                className="text-xs text-ds-danger underline decoration-dotted underline-offset-2 hover:brightness-110"
                              >
                                Delete
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataTableCard>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ds-foreground">Pending invites</h2>
            <p className="mt-1 text-xs text-ds-muted">
              Open invites that have not finished signup—no account to impersonate yet.
            </p>
            {pendingInvites.length === 0 ? (
              <p className="mt-3 text-sm text-ds-muted">No unused, non-expired invites.</p>
            ) : (
              <DataTableCard className="mt-3">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className={dataTableHeadRowClass}>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingInvites.map((r) => (
                        <tr key={r.invite_id} className={dataTableBodyRow()}>
                          <td className="px-4 py-3 text-ds-foreground">{r.email}</td>
                          <td className="px-4 py-3 text-ds-muted">{r.role}</td>
                          <td className="px-4 py-3 text-ds-muted">{r.company_name || r.company_id}</td>
                          <td className="px-4 py-3 text-xs text-ds-muted">{r.expires_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataTableCard>
            )}
          </div>
        </div>
      )}

      {impersonationModal ? (
        <ImpersonationTenantModal
          accessToken={impersonationModal.token}
          targetEmail={impersonationModal.email}
          targetName={impersonationModal.full_name}
          onClosed={() => setImpersonationModal(null)}
        />
      ) : null}

      {tenantModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--ds-text-primary)_38%,transparent)] p-4 backdrop-blur-sm"
          onClick={() => !tenantBusy && setTenantModal(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-ds-border bg-ds-elevated shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tenant-owner-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ds-border px-4 py-3">
              <div>
                <h2 id="tenant-owner-modal-title" className="text-sm font-semibold text-ds-foreground">
                  Tenant ownership
                </h2>
                <p className="text-xs text-ds-muted">
                  {tenantModal.companyName || "Company"} · updates{" "}
                  <span className="font-mono text-[10px]">owner_admin_id</span> and{" "}
                  <span className="font-mono text-[10px]">users.roles</span>
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-ds-muted hover:bg-ds-secondary disabled:opacity-40"
                disabled={tenantBusy}
                onClick={() => setTenantModal(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 p-4">
              <p className="text-sm text-ds-foreground">
                {tenantModal.mode === "pick_new_owner" ? (
                  <>
                    Current owner:{" "}
                    <strong>{tenantModal.currentOwnerRow.full_name || tenantModal.currentOwnerRow.email}</strong>.
                    Choose who should become the recorded tenant owner.
                  </>
                ) : (
                  <>
                    Set <strong>{tenantModal.candidateRow.full_name || tenantModal.candidateRow.email}</strong> as the
                    tenant owner. The previous owner&apos;s role will change to the option you pick below.
                  </>
                )}
              </p>
              {tenantModal.mode === "pick_new_owner" ? (
                <div>
                  <label className={dsLabelClass} htmlFor="tenant-new-owner">
                    New owner
                  </label>
                  <select
                    id="tenant-new-owner"
                    className={`mt-1.5 w-full ${INPUT}`}
                    disabled={tenantBusy || tenantMembersLoading}
                    value={newOwnerUserId}
                    onChange={(e) => setNewOwnerUserId(e.target.value)}
                  >
                    <option value="">Select user…</option>
                    {tenantMembers
                      .filter((m) => m.id !== tenantModal.currentOwnerRow.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.email}
                          {m.full_name ? ` (${m.full_name})` : ""} — {m.roles?.join(", ") || "—"}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label className={dsLabelClass} htmlFor="tenant-change-prev-role">
                  Change previous owner to
                </label>
                <select
                  id="tenant-change-prev-role"
                  className={`mt-1.5 w-full max-w-xs ${INPUT}`}
                  disabled={tenantBusy}
                  value={changePreviousOwnerTo}
                  onChange={(e) => setChangePreviousOwnerTo(e.target.value as PreviousOwnerRole)}
                >
                  {PREVIOUS_OWNER_ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {tenantMembersLoading ? (
                <div className="flex items-center gap-2 text-sm text-ds-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading company roster…
                </div>
              ) : null}
              {tenantErr ? <p className="text-sm text-ds-danger">{tenantErr}</p> : null}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ds-border pt-4">
                <Link
                  href={`/system/companies/${tenantModal.companyId}`}
                  className="text-xs font-semibold text-ds-accent underline decoration-dotted underline-offset-2 hover:brightness-110"
                >
                  Open company settings
                </Link>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    disabled={tenantBusy}
                    onClick={() => setTenantModal(null)}
                  >
                    Cancel
                  </button>
                  <button type="button" className={BTN_PRIMARY} disabled={tenantBusy} onClick={() => void submitTenantOwnerTransfer()}>
                    {tenantBusy ? "Applying…" : "Apply transfer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activityOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--ds-text-primary)_38%,transparent)] p-4 backdrop-blur-sm"
          onClick={() => setActivityOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl border border-ds-border bg-ds-elevated shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-activity-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ds-border px-4 py-3">
              <div>
                <h2 id="login-activity-title" className="text-sm font-semibold text-ds-foreground">
                  Login activity
                </h2>
                <p className="text-xs text-ds-muted">
                  {activityTarget?.full_name || activityTarget?.email || "User"} — last 20 sign-ins
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-ds-muted hover:bg-ds-secondary"
                onClick={() => setActivityOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[calc(85vh-4rem)] overflow-y-auto p-4">
              {activityLoading ? (
                <div className="flex items-center gap-2 text-sm text-ds-muted">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Loading…
                </div>
              ) : null}
              {activityError ? <p className="text-sm text-ds-danger">{activityError}</p> : null}
              {!activityLoading && !activityError && activityRows.length === 0 ? (
                <p className="text-sm text-ds-muted">No recorded logins yet.</p>
              ) : null}
              {!activityLoading && activityRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className={dataTableHeadRowClass}>
                        <th className="px-3 py-2">When</th>
                        <th className="px-3 py-2">IP</th>
                        <th className="px-3 py-2">Location</th>
                        <th className="px-3 py-2">User agent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityRows.map((ev) => (
                        <tr key={ev.id} className={dataTableBodyRow()}>
                          <td className="px-3 py-2 text-ds-foreground">{formatWhen(ev.timestamp)}</td>
                          <td className="px-3 py-2 text-ds-muted">{ev.ip_address}</td>
                          <td className="px-3 py-2 text-ds-muted">
                            {[ev.city, ev.region].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="max-w-[20rem] px-3 py-2 break-all text-ds-muted">{ev.user_agent || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
