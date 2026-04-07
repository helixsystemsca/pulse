"use client";

/**
 * Workers & Roles: permission matrix, roster by role, profile drawer, create user, settings.
 */
import {
  Box,
  Briefcase,
  ClipboardList,
  Loader2,
  MoreVertical,
  Search,
  Shield,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { readSession } from "@/lib/pulse-session";
import { emitOnboardingMaybeUpdated } from "@/lib/onboarding-events";
import {
  humanizeRole,
  isCreateRoleLimitedSession,
  managerOrAbove,
  principalHasAnyRole,
  primaryWorkerGroupKey,
  sessionHasAnyRole,
  sortRolesForDisplay,
} from "@/lib/pulse-roles";
import type { WorkerDetail, WorkerRow, WorkersSettings } from "@/lib/workersService";
import {
  createWorker,
  fetchWorkerDetail,
  fetchWorkerList,
  fetchWorkerSettings,
  patchWorker,
  patchWorkerSettings,
  resendWorkerInvite,
} from "@/lib/workersService";

type CompanyOption = { id: string; name: string };

const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-500";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

const MATRIX_ITEMS = [
  {
    key: "view_tools",
    label: "View Tools",
    description: "Asset visibility across zones.",
    icon: Wrench,
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-600 dark:text-white",
  },
  {
    key: "assign_jobs",
    label: "Assign Jobs",
    description: "Dispatcher-level authority.",
    icon: ClipboardList,
    tone: "bg-sky-100 text-[#2B4C7E] dark:bg-sky-600 dark:text-white",
  },
  {
    key: "manage_inventory",
    label: "Manage Inventory",
    description: "Modify stock and logistics.",
    icon: Box,
    tone: "bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-white",
  },
  {
    key: "manage_work_requests",
    label: "Manage Work Requests",
    description: "Create and triage maintenance requests.",
    icon: Briefcase,
    tone: "bg-indigo-50 text-indigo-800 dark:bg-indigo-600 dark:text-white",
  },
  {
    key: "view_reports",
    label: "View Reports",
    description: "Operational and compliance reports.",
    icon: Shield,
    tone: "bg-emerald-50 text-emerald-900 dark:bg-emerald-600 dark:text-white",
  },
] as const;

const SETTINGS_TABS = ["Roles", "Shifts", "Skill categories", "Certification rules"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

const PROFILE_ROLE_OPTIONS = ["worker", "lead", "supervisor", "manager"] as const;

type CreateFormState = {
  full_name: string;
  email: string;
  role: string;
  department: string;
  shift: string;
  start_date: string;
  skills: string;
  certifications: string;
  supervisor_id: string;
};

const CREATE_FORM_EMPTY: CreateFormState = {
  full_name: "",
  email: "",
  role: "worker",
  department: "",
  shift: "",
  start_date: "",
  skills: "",
  certifications: "",
  supervisor_id: "",
};

function initials(name: string | null | undefined, email: string): string {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    return p[0].slice(0, 2).toUpperCase();
  }
  return email.split("@")[0]?.slice(0, 2).toUpperCase() || "?";
}

function roleBadge(role: string): string {
  if (role === "company_admin") return "app-badge-sky";
  if (role === "manager") return "app-badge-blue";
  if (role === "supervisor") return "app-badge-blue";
  if (role === "lead") return "app-badge-emerald";
  return "app-badge-slate";
}

function roleGroupTitle(role: string): string {
  if (role === "company_admin") return "Company Admin";
  if (role === "manager") return "Managers";
  if (role === "supervisor") return "Supervisors";
  if (role === "lead") return "Leads";
  return "Workers";
}

function certBadge(status: string): string {
  if (status === "expired") return "app-badge-red";
  if (status === "valid") return "app-badge-emerald";
  return "app-badge-slate";
}

const DEFAULT_MATRIX: Record<string, boolean> = {
  view_tools: true,
  assign_jobs: true,
  manage_inventory: false,
  manage_work_requests: true,
  view_reports: true,
};

export function WorkersApp() {
  const session = readSession();
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const sessionCompanyId = session?.company_id ?? null;
  const canManage = managerOrAbove(session);
  const createRoleLimited = isCreateRoleLimitedSession(session);
  const isCompanyAdmin = sessionHasAnyRole(session, "company_admin");

  const [companyPick, setCompanyPick] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const effectiveCompanyId = isSystemAdmin ? companyPick : sessionCompanyId;
  const dataEnabled = Boolean(effectiveCompanyId) && canManage;
  const apiCompany = isSystemAdmin ? effectiveCompanyId : null;

  const [q, setQ] = useState("");
  const [list, setList] = useState<WorkerRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [fullSettings, setFullSettings] = useState<WorkersSettings>({});
  const [matrix, setMatrix] = useState<Record<string, boolean>>({ ...DEFAULT_MATRIX });
  const [matrixSaving, setMatrixSaving] = useState(false);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkerDetail | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [supervisorNoteDraft, setSupervisorNoteDraft] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileRolesDraft, setProfileRolesDraft] = useState<string[]>([]);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("Roles");
  const [settingsDraft, setSettingsDraft] = useState<WorkersSettings>({});
  const [certRulesText, setCertRulesText] = useState("[]");
  const [settingsBusy, setSettingsBusy] = useState(false);

  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [createInviteBusy, setCreateInviteBusy] = useState(false);
  const [createToast, setCreateToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null,
  );

  const [createForm, setCreateForm] = useState<CreateFormState>({ ...CREATE_FORM_EMPTY });

  useEffect(() => {
    if (!createToast) return;
    const t = window.setTimeout(() => setCreateToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [createToast]);

  useEffect(() => {
    if (!isSystemAdmin || !session?.access_token) return;
    void (async () => {
      try {
        const r = await apiFetch<CompanyOption[]>(`/api/system/companies?include_inactive=false&q=`);
        setCompanies(r.map((x) => ({ id: x.id, name: x.name })));
      } catch {
        setCompanies([]);
      }
    })();
  }, [isSystemAdmin, session?.access_token]);

  const loadList = useCallback(async () => {
    if (!dataEnabled || !effectiveCompanyId) return;
    setListLoading(true);
    setListError(null);
    try {
      const [wr, st] = await Promise.all([
        fetchWorkerList(apiCompany, { q: q.trim() || undefined }),
        fetchWorkerSettings(apiCompany),
      ]);
      setList(wr.items);
      setFullSettings(st.settings);
      const m = st.settings.permission_matrix ?? {};
      setMatrix({ ...DEFAULT_MATRIX, ...m });
      setSettingsDraft(st.settings);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : "Failed to load");
      setList([]);
    } finally {
      setListLoading(false);
    }
  }, [dataEnabled, effectiveCompanyId, apiCompany, q]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadList(), 280);
    return () => window.clearTimeout(t);
  }, [loadList]);

  const loadProfile = useCallback(async () => {
    if (!profileId || !effectiveCompanyId) return;
    setProfileLoading(true);
    try {
      const d = await fetchWorkerDetail(apiCompany, profileId);
      setProfile(d);
      setNoteDraft(d.profile_notes ?? "");
      setSupervisorNoteDraft(d.supervisor_notes ?? "");
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [profileId, effectiveCompanyId, apiCompany]);

  useEffect(() => {
    if (profileId) void loadProfile();
    else setProfile(null);
  }, [profileId, loadProfile]);

  useEffect(() => {
    if (!profile) {
      setProfileRolesDraft([]);
      return;
    }
    const base = profile.roles?.length ? [...profile.roles] : profile.role ? [profile.role] : ["worker"];
    setProfileRolesDraft(sortRolesForDisplay([...new Set(base)]));
  }, [profile]);

  const grouped = useMemo(() => {
    const order = ["company_admin", "manager", "supervisor", "lead", "worker"] as const;
    const m = new Map<string, WorkerRow[]>();
    for (const r of order) m.set(r, []);
    for (const w of list) {
      const k = primaryWorkerGroupKey(w);
      if (m.has(k)) m.get(k)!.push(w);
      else m.get("worker")!.push(w);
    }
    return order.map((role) => ({ role, items: m.get(role) ?? [] }));
  }, [list]);

  const supervisors = useMemo(
    () =>
      list.filter(
        (u) =>
          principalHasAnyRole(u, "supervisor", "manager", "company_admin") &&
          u.is_active &&
          (u.account_status ?? "active") === "active",
      ),
    [list],
  );

  async function saveMatrix() {
    if (!effectiveCompanyId) return;
    setMatrixSaving(true);
    try {
      const next = { ...fullSettings, permission_matrix: { ...matrix } };
      const r = await patchWorkerSettings(apiCompany, next);
      setFullSettings(r.settings);
      setMatrix({ ...DEFAULT_MATRIX, ...(r.settings.permission_matrix ?? {}) });
    } finally {
      setMatrixSaving(false);
    }
  }

  async function saveProfileNotes() {
    if (!profileId || !profile) return;
    setProfileBusy(true);
    try {
      await patchWorker(apiCompany, profileId, {
        profile_notes: noteDraft || null,
        supervisor_notes: supervisorNoteDraft || null,
      });
      await loadProfile();
      await loadList();
    } finally {
      setProfileBusy(false);
    }
  }

  function toggleProfileRole(key: string, on: boolean) {
    setProfileRolesDraft((prev) => {
      const set = new Set(prev);
      if (on) set.add(key);
      else set.delete(key);
      const next = sortRolesForDisplay([...set]);
      if (next.length < 1) return prev;
      return next;
    });
  }

  async function saveProfileRoles() {
    if (!profileId || !profile || !isCompanyAdmin) return;
    if (principalHasAnyRole(profile, "company_admin")) return;
    const uniq = [...new Set(profileRolesDraft.map((r) => r.trim()).filter(Boolean))];
    if (uniq.length < 1) return;
    setProfileBusy(true);
    try {
      await patchWorker(apiCompany, profileId, { roles: uniq });
      await loadProfile();
      await loadList();
    } finally {
      setProfileBusy(false);
    }
  }

  async function saveSettingsModal() {
    if (!effectiveCompanyId) return;
    setSettingsBusy(true);
    try {
      let rules: unknown = [];
      try {
        rules = JSON.parse(certRulesText || "[]");
      } catch {
        window.alert("Certification rules must be valid JSON.");
        return;
      }
      const r = await patchWorkerSettings(apiCompany, {
        ...fullSettings,
        ...settingsDraft,
        certification_rules: rules as WorkersSettings["certification_rules"],
      });
      setFullSettings(r.settings);
      setSettingsDraft(r.settings);
      setMatrix({ ...DEFAULT_MATRIX, ...(r.settings.permission_matrix ?? {}) });
      setSettingsOpen(false);
    } finally {
      setSettingsBusy(false);
    }
  }

  async function submitCreate() {
    if (!createForm.email.trim() || createInviteBusy) return;
    setCreateInviteBusy(true);
    try {
      const skills = createForm.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name, level: 3 }));
      const certLines = createForm.certifications.split("\n").map((l) => l.trim()).filter(Boolean);
      const certifications = certLines.map((line) => {
        const [name, exp] = line.split("|").map((x) => x.trim());
        return exp ? { name, expiry_date: `${exp}T12:00:00.000Z` } : { name };
      });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const result = await createWorker(apiCompany, {
        email: createForm.email.trim(),
        full_name: createForm.full_name.trim() || null,
        role: createForm.role,
        department: createForm.department.trim() || null,
        shift: createForm.shift || null,
        start_date: createForm.start_date || null,
        supervisor_id: createForm.supervisor_id.trim() || null,
        skills: skills.length ? skills : undefined,
        certifications: certifications.length ? certifications : undefined,
      });
      const absLink = `${origin}${result.invite_link_path}`;
      if (result.invite_email_sent === false) {
        setInviteNotice(`${result.message} Share this link with them: ${absLink}`);
      } else if (result.invite_email_sent === null) {
        setInviteNotice(
          `${result.message} If outbound email is configured, they will receive it shortly. You can also share: ${absLink}`,
        );
      } else {
        setInviteNotice(null);
      }
      setCreateOpen(false);
      setCreateForm({ ...CREATE_FORM_EMPTY });
      setCreateToast({ variant: "success", message: "Invite sent successfully" });
      await loadList();
      emitOnboardingMaybeUpdated();
    } catch (e) {
      const { message } = parseClientApiError(e);
      setCreateToast({
        variant: "error",
        message: message && message !== "Request failed" ? message : "Failed to send invite",
      });
    } finally {
      setCreateInviteBusy(false);
    }
  }

  if (!canManage) {
    return (
      <p className="text-sm text-pulse-muted">Workers & Roles are available to managers and administrators.</p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers & Roles"
        description="Manage personnel, roles, permissions, and operational readiness."
        icon={Shield}
        actions={
          <>
            <button
              type="button"
              className="app-btn-secondary px-4 py-2.5"
              onClick={() => {
                setSettingsDraft({ ...fullSettings });
                setCertRulesText(JSON.stringify(fullSettings.certification_rules ?? [], null, 2));
                setSettingsOpen(true);
              }}
              disabled={!dataEnabled}
            >
              Edit roles
            </button>
            <button
              type="button"
              className={PRIMARY_BTN}
              onClick={() => {
                setCreateForm((f) => ({ ...f, role: createRoleLimited ? "worker" : f.role }));
                setCreateOpen(true);
              }}
              disabled={!dataEnabled}
            >
              + Create & send invite
            </button>
          </>
        }
      />

      {createToast ? (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-[95] max-w-md -translate-x-1/2 rounded-md border px-4 py-3 text-sm font-medium shadow-lg ${
            createToast.variant === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-950/90 dark:text-emerald-100"
              : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/35 dark:bg-rose-950/90 dark:text-rose-100"
          }`}
        >
          {createToast.message}
        </div>
      ) : null}

      {inviteNotice ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          <p>{inviteNotice}</p>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-emerald-300 underline"
            onClick={() => setInviteNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {isSystemAdmin ? (
        <div className="mt-6 rounded-md border border-pulse-border bg-white p-4 shadow-sm dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-pulse-muted">Company</label>
          <select
            className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 md:w-auto"
            value={companyPick ?? ""}
            onChange={(e) => setCompanyPick(e.target.value || null)}
          >
            <option value="">Select company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!dataEnabled ? (
        <p className="mt-8 text-sm text-pulse-muted">
          {isSystemAdmin ? "Select a company to continue." : "Unable to resolve organization."}
        </p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="rounded-md border border-pulse-border bg-white p-5 shadow-sm ring-1 ring-slate-100/80 dark:border-[#1F2937] dark:bg-[#111827] dark:ring-white/[0.06] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
              <div className="flex items-center gap-2 text-pulse-navy">
                <Shield className="h-5 w-5 text-[#2B4C7E]" aria-hidden />
                <h2 className="text-sm font-bold tracking-tight">Permissions matrix</h2>
              </div>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-pulse-muted">Global policies</p>
              <div className="mt-4 space-y-3">
                {MATRIX_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const on = matrix[item.key] !== false;
                  return (
                    <div
                      key={item.key}
                      className="flex items-start justify-between gap-3 rounded-md border border-slate-100 bg-slate-50/50 px-3 py-3 dark:border-[#374151] dark:bg-[#0F172A]/70"
                    >
                      <div className="flex min-w-0 gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-pulse-navy">{item.label}</p>
                          <p className="mt-0.5 text-xs text-pulse-muted">{item.description}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        onClick={() => setMatrix((m) => ({ ...m, [item.key]: !on }))}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                          on ? "bg-[#2B4C7E]" : "bg-slate-200"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform dark:bg-gray-200 ${
                            on ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className={`${PRIMARY_BTN} mt-4 w-full`}
                disabled={matrixSaving}
                onClick={() => void saveMatrix()}
              >
                {matrixSaving ? "Saving…" : "Save permissions"}
              </button>
              <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/45 dark:text-amber-100">
                Permission changes apply immediately to all users in this role.
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 xl:col-span-9">
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted" />
              <input
                type="search"
                placeholder="Search workers or roles…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-sm text-pulse-navy placeholder:text-slate-400 outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>

            {listLoading ? (
              <div className="flex items-center gap-2 py-16 text-pulse-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading roster…
              </div>
            ) : listError ? (
              <p className="text-sm text-rose-600">{listError}</p>
            ) : (
              <div className="space-y-5">
                {grouped.map(({ role, items }) =>
                  items.length === 0 ? null : (
                    <div
                      key={role}
                      className="overflow-hidden rounded-md border border-pulse-border bg-white shadow-sm ring-1 ring-slate-100/80 dark:border-[#1F2937] dark:bg-[#111827] dark:ring-white/[0.06]"
                    >
                      <div className="app-table-head-row px-4 py-2.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-pulse-muted">
                          {roleGroupTitle(role)} ({items.length})
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-pulse-muted">
                              <th className="px-4 py-3">Name</th>
                              <th className="px-4 py-3">Role</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((row) => (
                              <tr
                                key={row.id}
                                className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/60 dark:border-[#1F2937] dark:hover:bg-[#0F172A]/90"
                                onClick={() => setProfileId(row.id)}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-pulse-navy ring-1 ring-slate-200/60">
                                      {initials(row.full_name, row.email)}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-pulse-navy">
                                        {row.full_name ?? row.email.split("@")[0]}
                                      </p>
                                      <p className="truncate text-xs text-pulse-muted">{row.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {sortRolesForDisplay(
                                      row.roles?.length ? [...row.roles] : [row.role],
                                    ).map((r) => (
                                      <span
                                        key={r}
                                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${roleBadge(r)}`}
                                      >
                                        {humanizeRole(r)}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center gap-1.5 text-sm text-pulse-navy">
                                    <span
                                      className={`h-2 w-2 rounded-full ${
                                        (row.account_status ?? "active") === "invited"
                                          ? "bg-amber-400"
                                          : row.is_active
                                            ? "bg-emerald-500"
                                            : "bg-slate-300"
                                      }`}
                                    />
                                    {(row.account_status ?? "active") === "invited"
                                      ? "Invited"
                                      : row.is_active
                                        ? "Active"
                                        : "Inactive"}
                                  </span>
                                </td>
                                <td className="relative px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-pulse-navy hover:bg-slate-50 dark:border-[#374151] dark:bg-[#1F2937] dark:text-gray-100 dark:hover:bg-[#374151]"
                                    aria-label="Actions"
                                    onClick={() => setMenuFor((m) => (m === row.id ? null : row.id))}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                  {menuFor === row.id ? (
                                    <div className="absolute right-4 z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg dark:border-[#374151] dark:bg-[#1F2937]">
                                      <button
                                        type="button"
                                        className="block w-full px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-[#374151]"
                                        onClick={() => {
                                          setMenuFor(null);
                                          setProfileId(row.id);
                                        }}
                                      >
                                        View profile
                                      </button>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {menuFor ? (
        <button
          type="button"
          className="fixed inset-0 z-20 cursor-default bg-transparent"
          aria-label="Close menu"
          onClick={() => setMenuFor(null)}
        />
      ) : null}

      <PulseDrawer
        open={createOpen}
        title="Add an employee"
        subtitle="Invite a team member to join your organization. They will choose their own password from the email link."
        onClose={() => {
          if (createInviteBusy) return;
          setCreateOpen(false);
        }}
        belowAppHeader
        wide
        labelledBy="worker-create-title"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-pulse-muted hover:text-pulse-navy disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-slate-200"
              disabled={createInviteBusy}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${PRIMARY_BTN} inline-flex items-center justify-center gap-2`}
              disabled={createInviteBusy || !createForm.email.trim()}
              onClick={() => void submitCreate()}
            >
              {createInviteBusy ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Sending...
                </>
              ) : (
                "Create & send invite"
              )}
            </button>
          </div>
        }
      >
        <p id="worker-create-title" className="sr-only">
          Add an employee
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL}>Name</label>
            <input
              className={FIELD}
              value={createForm.full_name}
              onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </div>
          <div>
            <label className={LABEL}>Email</label>
            <input
              type="email"
              className={FIELD}
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className={LABEL}>Role</label>
            <select
              className={FIELD}
              value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="worker">Worker</option>
              <option value="lead">Lead</option>
              {createRoleLimited ? null : (
                <>
                  <option value="supervisor">Supervisor</option>
                  <option value="manager">Manager</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className={LABEL}>Department</label>
            <input
              className={FIELD}
              value={createForm.department}
              onChange={(e) => setCreateForm((f) => ({ ...f, department: e.target.value }))}
            />
          </div>
          <div>
            <label className={LABEL}>Shift</label>
            <select
              className={FIELD}
              value={createForm.shift}
              onChange={(e) => setCreateForm((f) => ({ ...f, shift: e.target.value }))}
            >
              <option value="">—</option>
              {(fullSettings.shifts ?? []).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Supervisor</label>
            <select
              className={FIELD}
              value={createForm.supervisor_id}
              onChange={(e) => setCreateForm((f) => ({ ...f, supervisor_id: e.target.value }))}
            >
              <option value="">—</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {(s.full_name ?? s.email) +
                    ` (${sortRolesForDisplay(s.roles?.length ? s.roles : [s.role])
                      .map((x) => humanizeRole(x))
                      .join(", ")})`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Start date</label>
            <input
              type="date"
              className={FIELD}
              value={createForm.start_date}
              onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Skills (comma-separated tags)</label>
            <input
              className={FIELD}
              placeholder="Welding, Electrical, HVAC"
              value={createForm.skills}
              onChange={(e) => setCreateForm((f) => ({ ...f, skills: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Certifications (one per line, optional expiry after | as YYYY-MM-DD)</label>
            <textarea
              className={`${FIELD} min-h-[80px]`}
              placeholder={"First Aid\nForklift | 2026-12-31"}
              value={createForm.certifications}
              onChange={(e) => setCreateForm((f) => ({ ...f, certifications: e.target.value }))}
            />
          </div>
        </div>
      </PulseDrawer>

      <PulseDrawer
        open={Boolean(profileId)}
        title={profile?.full_name ?? profile?.email ?? "Worker profile"}
        subtitle={profile ? profile.email : undefined}
        onClose={() => setProfileId(null)}
        wide
        elevated
        labelledBy="worker-profile-title"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-3">
            {(profile?.account_status ?? "active") === "invited" ? (
              <button
                type="button"
                className="rounded-[10px] border border-slate-200/90 px-4 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm hover:bg-slate-50 dark:border-[#374151] dark:text-gray-100 dark:hover:bg-[#1F2937]"
                disabled={profileBusy}
                onClick={() => {
                  if (!profileId || !profile) return;
                  void (async () => {
                    setProfileBusy(true);
                    try {
                      const r = await resendWorkerInvite(apiCompany, profileId);
                      const origin = typeof window !== "undefined" ? window.location.origin : "";
                      setInviteNotice(
                        r.invite_email_sent === false
                          ? `${r.message} Link: ${origin}${r.invite_link_path}`
                          : `${r.message} They can use: ${origin}${r.invite_link_path}`,
                      );
                    } finally {
                      setProfileBusy(false);
                    }
                  })();
                }}
              >
                Resend invite
              </button>
            ) : null}
            <button type="button" className={PRIMARY_BTN} disabled={profileBusy} onClick={() => void saveProfileNotes()}>
              {profileBusy ? "Saving…" : "Save notes"}
            </button>
          </div>
        }
      >
        {profileLoading || !profile ? (
          <div className="flex items-center gap-2 text-pulse-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="space-y-8" id="worker-profile-title">
            <section>
              <h3 className={LABEL}>Basic info</h3>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <p className="sm:col-span-2">
                  <span className="text-pulse-muted">Roles: </span>
                  <span className="ms-1 inline-flex flex-wrap gap-1 align-middle">
                    {sortRolesForDisplay(profile.roles?.length ? profile.roles : [profile.role]).map((r) => (
                      <span
                        key={r}
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${roleBadge(r)}`}
                      >
                        {humanizeRole(r)}
                      </span>
                    ))}
                  </span>
                </p>
                <p>
                  <span className="text-pulse-muted">Status: </span>
                  <span className="font-medium text-pulse-navy">{profile.is_active ? "Active" : "Inactive"}</span>
                </p>
                <p>
                  <span className="text-pulse-muted">Email: </span>
                  {profile.email}
                </p>
                <p>
                  <span className="text-pulse-muted">Phone: </span>
                  {profile.phone ?? "—"}
                </p>
                <p>
                  <span className="text-pulse-muted">Start date: </span>
                  {profile.start_date ?? "—"}
                </p>
              </div>
            </section>

            {isCompanyAdmin && !principalHasAnyRole(profile, "company_admin") ? (
              <section>
                <h3 className={LABEL}>Edit roles</h3>
                <p className="mt-1 text-xs text-pulse-muted">
                  Select every role this person should have for scheduling, supervision, and permissions. At least one
                  role is required.
                </p>
                <div className="mt-3 space-y-2 rounded-lg border border-slate-100 bg-white p-3 dark:border-[#374151] dark:bg-[#0F172A]/80">
                  {PROFILE_ROLE_OPTIONS.map((key) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-pulse-navy">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/50"
                        checked={profileRolesDraft.includes(key)}
                        onChange={(e) => toggleProfileRole(key, e.target.checked)}
                      />
                      {humanizeRole(key)}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="app-btn-secondary mt-3 px-4 py-2 text-sm font-semibold"
                  disabled={profileBusy}
                  onClick={() => void saveProfileRoles()}
                >
                  {profileBusy ? "Saving…" : "Save roles"}
                </button>
              </section>
            ) : null}

            <section>
              <h3 className={LABEL}>Position &amp; shift</h3>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-pulse-muted">Job title: </span>
                  {profile.job_title ?? "—"}
                </p>
                <p>
                  <span className="text-pulse-muted">Department: </span>
                  {profile.department ?? "—"}
                </p>
                <p>
                  <span className="text-pulse-muted">Shift: </span>
                  {profile.shift ?? "—"}
                </p>
                <p>
                  <span className="text-pulse-muted">Supervisor: </span>
                  {profile.supervisor_name ?? "—"}
                </p>
              </div>
            </section>

            <section>
              <h3 className={LABEL}>Certifications</h3>
              <ul className="mt-2 space-y-2">
                {profile.certifications.length === 0 ? (
                  <li className="text-sm text-pulse-muted">None on file.</li>
                ) : (
                  profile.certifications.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 dark:border-[#374151] dark:bg-[#0F172A]"
                    >
                      <span className="font-medium text-pulse-navy">{c.name}</span>
                      <span className="text-xs text-pulse-muted">
                        {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : "No expiry"}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${certBadge(c.status)}`}>
                        {c.status.replace("_", " ")}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section>
              <h3 className={LABEL}>Specialty training</h3>
              <ul className="mt-2 space-y-1 text-sm text-pulse-navy">
                {profile.training.length === 0 ? (
                  <li className="text-pulse-muted">None recorded.</li>
                ) : (
                  profile.training.map((t) => (
                    <li key={t.id}>
                      {t.name} · {new Date(t.completed_at).toLocaleDateString()}
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section>
              <h3 className={LABEL}>Skill affinities</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.skills.length === 0 ? (
                  <span className="text-sm text-pulse-muted">None tagged.</span>
                ) : (
                  profile.skills.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-pulse-navy ring-1 ring-slate-200/80"
                    >
                      {s.name} · L{s.level}
                    </span>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className={LABEL}>Compliance summary</h3>
              <div className="mt-2 grid gap-2 rounded-md border border-slate-100 bg-slate-50/80 p-4 text-sm sm:grid-cols-2 dark:border-[#374151] dark:bg-[#0F172A]/90 dark:text-gray-200">
                <p>
                  Compliance rate:{" "}
                  <span className="font-bold text-pulse-navy">{profile.compliance_summary.compliance_rate_pct}%</span>
                </p>
                <p>Missed acknowledgments: {profile.compliance_summary.missed_acknowledgments}</p>
                <p>Flags: {profile.compliance_summary.flagged_count}</p>
                <p>
                  Repeat offender:{" "}
                  {profile.compliance_summary.repeat_offender ? (
                    <span className="font-semibold text-rose-700">Yes</span>
                  ) : (
                    <span className="text-pulse-muted">No</span>
                  )}
                </p>
              </div>
            </section>

            <section>
              <h3 className={LABEL}>Work activity</h3>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                <p>Open work requests: {profile.work_summary.open_work_requests}</p>
                <p>Completed (90d): {profile.work_summary.completed_tasks}</p>
                <p>
                  Avg completion (h):{" "}
                  {profile.work_summary.avg_completion_hours != null
                    ? profile.work_summary.avg_completion_hours
                    : "—"}
                </p>
              </div>
            </section>

            <section>
              <h3 className={LABEL}>Notes / supervisor comments</h3>
              <div className="mt-2 space-y-3">
                <div>
                  <p className="text-xs text-pulse-muted">Profile notes</p>
                  <textarea
                    className={`${FIELD} min-h-[72px]`}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs text-pulse-muted">Supervisor (internal)</p>
                  <textarea
                    className={`${FIELD} min-h-[72px]`}
                    value={supervisorNoteDraft}
                    onChange={(e) => setSupervisorNoteDraft(e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>
        )}
      </PulseDrawer>

      <PulseDrawer
        open={settingsOpen}
        title="Workers configuration"
        subtitle="Roles, shifts, skill categories, and certification rules"
        onClose={() => setSettingsOpen(false)}
        wide
        elevated
        labelledBy="workers-settings-title"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-pulse-muted hover:text-pulse-navy"
              onClick={() => setSettingsOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className={PRIMARY_BTN} disabled={settingsBusy} onClick={() => void saveSettingsModal()}>
              Save &amp; close
            </button>
          </div>
        }
      >
        <div className="mx-auto max-w-xl space-y-5">
          <p id="workers-settings-title" className="sr-only">
            Workers configuration
          </p>
          <div>
            <p className={LABEL}>Section</p>
            <div className="mt-1.5 flex flex-wrap gap-1 rounded-[10px] border border-slate-200/80 bg-slate-100/85 p-1">
              {SETTINGS_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSettingsTab(t)}
                  className={`rounded-lg px-2.5 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
                    settingsTab === t
                      ? "bg-white text-[#2B4C7E] shadow-sm ring-1 ring-slate-200/90 dark:bg-[#1e3a5f] dark:text-sky-100 dark:ring-sky-500/35"
                      : "text-pulse-muted hover:bg-white/70 dark:text-gray-400 dark:hover:bg-[#1F2937]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {settingsTab === "Roles" ? (
            <div className="space-y-3">
              <p className="text-xs text-pulse-muted">
                Display labels for built-in roles. Permission toggles are on the main screen.
              </p>
              {(settingsDraft.roles ?? []).map((r, i) => (
                <div key={r.key} className="flex gap-2">
                  <input
                    className={FIELD}
                    value={r.label}
                    onChange={(e) => {
                      const roles = [...(settingsDraft.roles ?? [])];
                      roles[i] = { ...r, label: e.target.value };
                      setSettingsDraft((s) => ({ ...s, roles }));
                    }}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {settingsTab === "Shifts" ? (
            <div className="space-y-2">
              {(settingsDraft.shifts ?? []).map((sh, i) => (
                <div key={sh.key} className="grid gap-2 sm:grid-cols-2">
                  <input
                    className={FIELD}
                    value={sh.key}
                    onChange={(e) => {
                      const shifts = [...(settingsDraft.shifts ?? [])];
                      shifts[i] = { ...sh, key: e.target.value };
                      setSettingsDraft((s) => ({ ...s, shifts }));
                    }}
                  />
                  <input
                    className={FIELD}
                    value={sh.label}
                    onChange={(e) => {
                      const shifts = [...(settingsDraft.shifts ?? [])];
                      shifts[i] = { ...sh, label: e.target.value };
                      setSettingsDraft((s) => ({ ...s, shifts }));
                    }}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {settingsTab === "Skill categories" ? (
            <div>
              <label className={LABEL}>Tags (comma-separated)</label>
              <input
                className={FIELD}
                value={(settingsDraft.skill_categories ?? []).join(", ")}
                onChange={(e) =>
                  setSettingsDraft((s) => ({
                    ...s,
                    skill_categories: e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
                  }))
                }
              />
            </div>
          ) : null}

          {settingsTab === "Certification rules" ? (
            <div>
              <label className={LABEL}>Rules (JSON array)</label>
              <textarea
                className={`${FIELD} min-h-[160px] font-mono text-xs`}
                value={certRulesText}
                onChange={(e) => setCertRulesText(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </PulseDrawer>
    </div>
  );
}
