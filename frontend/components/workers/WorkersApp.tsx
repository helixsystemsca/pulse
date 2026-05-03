"use client";

/**
 * Team Management (formerly Workers & Roles): role permissions, roster, profile drawer, create user, settings.
 */
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { dataTableBodyRow, dataTableHeadRowClass } from "@/components/ui/DataTable";
import {
  dsCheckboxClass,
  dsInputClass,
  dsInputStackedClass,
  dsLabelClass,
  dsSelectClass,
} from "@/components/ui/ds-form-classes";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch, refreshPulseUserFromServer } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import {
  humanizeRole,
  isCreateRoleLimitedSession,
  managerOrAbove,
  principalHasAnyRole,
  primaryWorkerGroupKey,
  sessionHasAnyRole,
  sortRolesForDisplay,
} from "@/lib/pulse-roles";
import { parseTimeToMinutes } from "@/lib/schedule/calendar";
import {
  buildRecurringRowsForDays,
  canonicalRecurringJson,
  editableShiftWindowFromProfile,
  padHm,
  recurringRowsFromApi,
  rotationDaysFromRecurring,
  ROTATION_WEEKDAY_SHORT,
  shiftWindowFromRosterKey,
} from "@/lib/workerRotation";
import type { LoginEventRow, WorkerDetail, WorkerRow, WorkersSettings } from "@/lib/workersService";
import {
  createWorker,
  deleteWorker,
  fetchUserLoginEvents,
  fetchWorkerDetail,
  fetchWorkerList,
  fetchWorkerSettings,
  patchWorker,
  patchWorkerSettings,
  resendWorkerInvite,
} from "@/lib/workersService";
import { UserProfileAvatarPreview } from "@/components/profile/UserProfileAvatarPreview";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type CompanyOption = { id: string; name: string };

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");
const FIELD = dsInputStackedClass;
const LABEL = dsLabelClass;
const SECTION_KICKER = "text-[11px] font-semibold uppercase tracking-wider text-ds-success";

const EMPTY_ROTATION_DAYS: boolean[] = [false, false, false, false, false, false, false];

const ROTATION_PRESET_BUTTONS: { label: string; days: boolean[] }[] = [
  { label: "Sun–Wed", days: [true, true, true, true, false, false, false] },
  { label: "Tue–Sat", days: [false, false, true, true, true, true, true] },
  { label: "Mon–Fri", days: [false, true, true, true, true, true, false] },
  { label: "All week", days: [true, true, true, true, true, true, true] },
];

/** Keys must match `GLOBAL_SYSTEM_FEATURES` / tenant contract (system admin catalog). */
const TENANT_PRODUCT_MODULES = [
  "compliance",
  "schedule",
  "monitoring",
  "projects",
  "work_requests",
  "procedures",
  "team_insights",
  "inventory",
  "equipment",
  "drawings",
  "zones_devices",
  "live_map",
] as const;

const MODULE_LABEL: Record<string, string> = {
  compliance: "Inspections & Logs",
  schedule: "Schedule",
  monitoring: "Monitoring",
  projects: "Projects",
  work_requests: "Work Requests",
  procedures: "Procedures",
  team_insights: "Team Insights",
  inventory: "Inventory",
  equipment: "Equipment",
  drawings: "Drawings",
  zones_devices: "Zones & Devices",
  live_map: "Live Map",
};

const SETTINGS_TABS = ["Roles", "Shifts", "Skill categories", "Certification rules"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

/** Shown when the invite exists but email delivery is uncertain or disabled — share link manually. */
type InviteLinkBanner = {
  inviteUrl: string;
  variant: "no_email" | "email_maybe" | "link_only";
};

const PROFILE_ROLE_OPTIONS = ["worker", "lead", "supervisor", "manager"] as const;

const EMPLOYMENT_TYPE_KEYS = ["full_time", "regular_part_time", "part_time"] as const;
type EmploymentTypeKey = (typeof EMPLOYMENT_TYPE_KEYS)[number] | "";

function normalizeEmploymentDraft(raw: string | null | undefined): EmploymentTypeKey {
  const s = (raw ?? "").trim();
  return (EMPLOYMENT_TYPE_KEYS as readonly string[]).includes(s) ? (s as EmploymentTypeKey) : "";
}

function formatRotationReadOnly(profile: WorkerDetail): string {
  const rows = recurringRowsFromApi(profile.recurring_shifts ?? []);
  if (!rows.length) return "—";
  const days = rotationDaysFromRecurring(rows);
  const bits = ROTATION_WEEKDAY_SHORT.filter((_, i) => days[i]).join(", ");
  const w = rows[0];
  return `${bits} (${w.start}–${w.end})`;
}

type CreateFormState = {
  full_name: string;
  email: string;
  role: string;
  employment_type: "full_time" | "regular_part_time" | "part_time";
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
  employment_type: "full_time",
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

function WorkerRosterFace({
  avatarUrl,
  fullName,
  email,
}: {
  avatarUrl?: string | null;
  fullName: string | null;
  email: string;
}) {
  const src = useResolvedAvatarSrc(avatarUrl ?? null);
  const ini = initials(fullName, email);
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ds-secondary text-xs font-bold text-ds-foreground ring-1 ring-ds-border">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        ini
      )}
    </span>
  );
}

function roleBadge(role: string): string {
  if (role === "company_admin") return "app-badge-blue";
  if (role === "manager") return "app-badge-blue";
  if (role === "supervisor") return "app-badge-blue";
  if (role === "lead") return "app-badge-emerald";
  return "app-badge-slate";
}

function shiftRosterLabel(
  key: string | null | undefined,
  shifts: { key: string; label: string }[] | undefined,
): string {
  const k = key?.trim();
  if (!k) return "—";
  const row = shifts?.find((s) => s.key === k);
  if (row?.label) return row.label;
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

function formatLoginWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatLoginPlace(row: WorkerRow): string {
  const c = row.last_login_city?.trim();
  const r = row.last_login_region?.trim();
  if (c && r) return `${c}, ${r}`;
  if (c) return c;
  if (r) return r;
  return "—";
}

function shortenUa(ua: string | null | undefined, max = 72): string {
  const s = (ua ?? "").trim();
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

const PERMISSION_ROLE_OPTIONS = ["manager", "supervisor", "lead", "worker"] as const;
type PermissionRole = (typeof PERMISSION_ROLE_OPTIONS)[number];

export function WorkersApp() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() || "/dashboard/workers";
  const { session, refresh } = usePulseAuth();
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const sessionCompanyId = session?.company_id ?? null;
  const createRoleLimited = isCreateRoleLimitedSession(session);
  const isCompanyAdmin = sessionHasAnyRole(session, "company_admin");
  /** External IT `company_admin` role or in-facility delegate (`facility_tenant_admin` from sysadmin). */
  const isTenantFullAdmin = isCompanyAdmin || Boolean(session?.facility_tenant_admin);
  /** Matches `/auth/me` → `workers_roster_access` (company admin + delegated roles from workers settings). */
  const canOpenWorkers = Boolean(
    isSystemAdmin ||
      session?.workers_roster_access ||
      (session?.workers_roster_access !== false && isTenantFullAdmin),
  );

  const [contractFeatureNamesFromApi, setContractFeatureNamesFromApi] = useState<string[]>([]);
  const contractCatalog = useMemo(
    () => session?.contract_enabled_features ?? contractFeatureNamesFromApi,
    [session?.contract_enabled_features, contractFeatureNamesFromApi],
  );

  const [companyPick, setCompanyPick] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const effectiveCompanyId = isSystemAdmin ? companyPick : sessionCompanyId;
  const dataEnabled = Boolean(effectiveCompanyId) && (isSystemAdmin ? Boolean(companyPick) : canOpenWorkers);
  const apiCompany = isSystemAdmin ? effectiveCompanyId : null;

  const [q, setQ] = useState("");
  const [list, setList] = useState<WorkerRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [fullSettings, setFullSettings] = useState<WorkersSettings>({});

  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    const p = searchParams.get("profile")?.trim();
    if (p) setProfileId(p);
  }, [searchParams]);
  const [profile, setProfile] = useState<WorkerDetail | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [supervisorNoteDraft, setSupervisorNoteDraft] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileRolesDraft, setProfileRolesDraft] = useState<string[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("Roles");
  const [settingsDraft, setSettingsDraft] = useState<WorkersSettings>({});
  const [certRulesText, setCertRulesText] = useState("[]");
  const [settingsBusy, setSettingsBusy] = useState(false);

  const [delegationDraft, setDelegationDraft] = useState({
    manager: false,
    supervisor: false,
    lead: false,
  });
  const [roleFeatureAccessDraft, setRoleFeatureAccessDraft] = useState<Record<string, string[]>>({});
  const [proceduresEditRolesDraft, setProceduresEditRolesDraft] = useState<string[]>(["manager", "supervisor", "lead"]);
  const [workRequestEditRolesDraft, setWorkRequestEditRolesDraft] = useState<string[]>(["manager", "supervisor"]);
  const [zoneManageRolesDraft, setZoneManageRolesDraft] = useState<string[]>(["manager", "supervisor"]);
  const [accessPolicySaving, setAccessPolicySaving] = useState(false);
  const [permissionsRole, setPermissionsRole] = useState<PermissionRole>("manager");
  const [extraModulesDraft, setExtraModulesDraft] = useState<string[]>([]);

  const [basicDraft, setBasicDraft] = useState({
    full_name: "",
    email: "",
    phone: "",
    start_date: "",
    employment_type: "" as EmploymentTypeKey,
  });
  const [positionDraft, setPositionDraft] = useState({
    job_title: "",
    department: "",
    shift: "",
    supervisor_id: "",
  });
  const [rotationDaysDraft, setRotationDaysDraft] = useState<boolean[]>(() => [...EMPTY_ROTATION_DAYS]);
  const [shiftTimeDraft, setShiftTimeDraft] = useState({ start: "07:00", end: "15:00" });

  const [inviteNotice, setInviteNotice] = useState<InviteLinkBanner | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [inviteLinkBusyId, setInviteLinkBusyId] = useState<string | null>(null);
  const joinLinkRequestLock = useRef(false);

  useEffect(() => {
    setInviteLinkCopied(false);
  }, [inviteNotice?.inviteUrl]);
  const [createInviteBusy, setCreateInviteBusy] = useState(false);
  const [createToast, setCreateToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null,
  );

  const [activityUserId, setActivityUserId] = useState<string | null>(null);
  const [activityLabel, setActivityLabel] = useState("");
  const [activityRows, setActivityRows] = useState<LoginEventRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

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
      setContractFeatureNamesFromApi(st.contract_feature_names ?? []);
      setFullSettings(st.settings);
      const cat = session?.contract_enabled_features ?? [];
      const wpd = st.settings.workers_page_delegation;
      if (wpd && typeof wpd === "object") {
        setDelegationDraft({
          manager: Boolean(wpd.manager),
          supervisor: Boolean(wpd.supervisor),
          lead: Boolean(wpd.lead),
        });
      }
      const rfa = (st.settings.role_feature_access ?? {}) as Record<string, string[]>;
      const nextDraft: Record<string, string[]> = {};
      for (const role of ["manager", "supervisor", "lead", "worker"] as const) {
        nextDraft[role] = rfa[role]?.length ? [...rfa[role]] : [...cat];
      }
      setRoleFeatureAccessDraft(nextDraft);
      setProceduresEditRolesDraft(
        Array.isArray(st.settings.procedures_edit_roles) && st.settings.procedures_edit_roles.length
          ? [...st.settings.procedures_edit_roles]
          : ["manager", "supervisor", "lead"],
      );
      setWorkRequestEditRolesDraft(
        Array.isArray(st.settings.work_request_edit_roles) && st.settings.work_request_edit_roles.length
          ? [...st.settings.work_request_edit_roles]
          : ["manager", "supervisor"],
      );
      setZoneManageRolesDraft(
        Array.isArray(st.settings.zone_manage_roles) && st.settings.zone_manage_roles.length
          ? [...st.settings.zone_manage_roles]
          : ["manager", "supervisor"],
      );
      setSettingsDraft(st.settings);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : "Failed to load");
      setList([]);
    } finally {
      setListLoading(false);
    }
  }, [dataEnabled, effectiveCompanyId, apiCompany, q, session?.contract_enabled_features]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadList(), 280);
    return () => window.clearTimeout(t);
  }, [loadList]);

  const openLoginActivity = useCallback(async (target: Pick<WorkerRow, "id" | "full_name" | "email">) => {
    setActivityUserId(target.id);
    setActivityLabel(target.full_name ?? target.email);
    setActivityLoading(true);
    setActivityError(null);
    setActivityRows([]);
    try {
      const rows = await fetchUserLoginEvents(target.id);
      setActivityRows(rows);
    } catch (e: unknown) {
      setActivityError(parseClientApiError(e).message);
    } finally {
      setActivityLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (!profile) {
      setExtraModulesDraft([]);
      return;
    }
    setExtraModulesDraft([...(profile.feature_allow_extra ?? [])]);
  }, [profile?.id, profile]);

  useEffect(() => {
    if (!profile) return;
    setBasicDraft({
      full_name: profile.full_name ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      start_date: profile.start_date ? profile.start_date.slice(0, 10) : "",
      employment_type: normalizeEmploymentDraft(profile.employment_type),
    });
    setPositionDraft({
      job_title: profile.job_title ?? "",
      department: profile.department ?? "",
      shift: profile.shift ?? "",
      supervisor_id: profile.supervisor_id ?? "",
    });
    setRotationDaysDraft(rotationDaysFromRecurring(recurringRowsFromApi(profile.recurring_shifts ?? [])));
    setShiftTimeDraft(editableShiftWindowFromProfile(profile, fullSettings.shifts ?? []));
  }, [profile, fullSettings.shifts]);

  /** HR fields (not roles/modules): company admin, or manager/supervisor for non-admin profiles, or lead for workers. */
  const canEditWorkerBasics = useMemo(() => {
    if (!profile || !session) return false;
    if (isTenantFullAdmin) return true;
    if (principalHasAnyRole(profile, "company_admin")) return false;
    if (managerOrAbove(session)) return true;
    if (sessionHasAnyRole(session, "lead") && principalHasAnyRole(profile, "worker")) return true;
    return false;
  }, [profile, session, isTenantFullAdmin]);

  /** Soft-remove from roster (PATCH is_active); matches server rules for company_admin / manager / supervisor. */
  const canDeactivateProfile = useMemo(() => {
    if (!profile || !session?.sub) return false;
    if (profile.id === session.sub) return false;
    if (principalHasAnyRole(profile, "company_admin")) return false;
    if (isTenantFullAdmin) return true;
    if (managerOrAbove(session) && principalHasAnyRole(profile, "worker", "lead")) return true;
    return false;
  }, [profile, session, isTenantFullAdmin]);

  /** Hard-delete roster user (API enforces company / system admin). */
  const canDeleteWorkerProfile = useMemo(() => {
    if (!profile || !session?.sub) return false;
    if (profile.id === session.sub) return false;
    if (principalHasAnyRole(profile, "company_admin")) return false;
    return isTenantFullAdmin || isSystemAdmin;
  }, [profile, session, isTenantFullAdmin, isSystemAdmin]);

  const clearProfileQueryFromUrl = useCallback(() => {
    const q = new URLSearchParams(searchParams.toString());
    if (!q.has("profile")) return;
    q.delete("profile");
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  /** `sendEmail: false` issues a fresh join token and returns the URL without sending another invite email. */
  const obtainInvitedWorkerJoinLink = useCallback(
    async (workerId: string, sendEmail: boolean) => {
      if (joinLinkRequestLock.current) return;
      joinLinkRequestLock.current = true;
      setInviteLinkBusyId(workerId);
      try {
        const r = await resendWorkerInvite(apiCompany, workerId, { sendEmail });
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const url = `${origin}${r.invite_link_path}`;
        if (!sendEmail) {
          try {
            await navigator.clipboard.writeText(url);
            setInviteLinkCopied(true);
            window.setTimeout(() => setInviteLinkCopied(false), 2000);
          } catch {
            // Banner still lists the URL for manual copy.
          }
          setInviteNotice({ inviteUrl: url, variant: "link_only" });
          setCreateToast({
            variant: "success",
            message: "Join link copied. Send it manually if the invite email did not arrive.",
          });
        } else {
          setInviteNotice({
            inviteUrl: url,
            variant: r.invite_email_sent === false ? "no_email" : "email_maybe",
          });
        }
      } catch (e: unknown) {
        setCreateToast({ variant: "error", message: parseClientApiError(e).message });
      } finally {
        joinLinkRequestLock.current = false;
        setInviteLinkBusyId(null);
      }
    },
    [apiCompany],
  );

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

  const canDeleteInvitedFromList = isTenantFullAdmin || isSystemAdmin;

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

  const profileSupervisorOptions = useMemo(() => {
    if (!profile) return supervisors;
    return supervisors.filter((u) => u.id !== profile.id);
  }, [supervisors, profile]);

  function toggleRoleModule(role: string, mod: string) {
    setRoleFeatureAccessDraft((prev) => {
      const cur = new Set(prev[role] ?? []);
      if (cur.has(mod)) cur.delete(mod);
      else cur.add(mod);
      return { ...prev, [role]: [...cur].sort() };
    });
  }

  async function deleteInvitedWorkerFromList(row: WorkerRow) {
    if (!canDeleteInvitedFromList) return;
    if ((row.account_status ?? "active") !== "invited") return;
    const label = row.full_name?.trim() || row.email;
    if (
      !window.confirm(
        `Delete invited worker ${label}? This permanently removes the pending invite and user record. This cannot be undone.`,
      )
    ) {
      return;
    }
    setProfileBusy(true);
    try {
      await deleteWorker(apiCompany, row.id);
      setCreateToast({ message: "Invited worker deleted.", variant: "success" });
      if (profileId === row.id) {
        setProfileId(null);
        clearProfileQueryFromUrl();
      }
      await loadList();
      await refreshPulseUserFromServer();
      refresh();
    } catch (e: unknown) {
      const err = parseClientApiError(e);
      // If the invite was already cleared on the server (stale list), treat it as success and refresh the roster.
      if (err.status === 404) {
        setCreateToast({ message: "Invite already removed.", variant: "success" });
        await loadList();
        await refreshPulseUserFromServer();
        refresh();
      } else {
        setCreateToast({ message: err.message, variant: "error" });
      }
    } finally {
      setProfileBusy(false);
    }
  }

  async function removeWorkerProfilePermanently() {
    if (!profileId || !profile || !canDeleteWorkerProfile) return;
    const label = profile.full_name?.trim() || profile.email;
    if (
      !window.confirm(
        `Permanently delete ${label}? Their sign-in will be removed. Schedule assignments and other links to this user may be cleared. This cannot be undone.`,
      )
    ) {
      return;
    }
    setProfileBusy(true);
    try {
      await deleteWorker(apiCompany, profileId);
      setCreateToast({ message: "User deleted.", variant: "success" });
      setProfileId(null);
      clearProfileQueryFromUrl();
      await loadList();
      await refreshPulseUserFromServer();
      refresh();
    } catch (e: unknown) {
      setCreateToast({ message: parseClientApiError(e).message, variant: "error" });
    } finally {
      setProfileBusy(false);
    }
  }

  async function setProfileActive(next: boolean) {
    if (!profileId || !profile || !canDeactivateProfile) return;
    const label = profile.full_name ?? profile.email;
    const msg = next
      ? `Restore roster access for ${label}? They will be able to sign in again if they have credentials.`
      : `Remove ${label} from the roster? They will no longer be able to sign in until reactivated.`;
    if (!confirm(msg)) return;
    setProfileBusy(true);
    try {
      const updated = await patchWorker(apiCompany, profileId, { is_active: next });
      setProfile(updated);
      setCreateToast({
        message: next ? "User reactivated." : "User deactivated.",
        variant: "success",
      });
      await loadList();
      if (!next) {
        setProfileId(null);
        clearProfileQueryFromUrl();
      }
    } catch (e: unknown) {
      setCreateToast({ message: parseClientApiError(e).message, variant: "error" });
    } finally {
      setProfileBusy(false);
    }
  }

  async function saveAccessPolicy() {
    if (!effectiveCompanyId || !isTenantFullAdmin) return;
    setAccessPolicySaving(true);
    try {
      const r = await patchWorkerSettings(apiCompany, {
        ...fullSettings,
        workers_page_delegation: delegationDraft,
        role_feature_access: roleFeatureAccessDraft,
        procedures_edit_roles: proceduresEditRolesDraft,
        work_request_edit_roles: workRequestEditRolesDraft,
        zone_manage_roles: zoneManageRolesDraft,
      });
      setContractFeatureNamesFromApi(r.contract_feature_names ?? []);
      setFullSettings(r.settings);
      setSettingsDraft(r.settings);
      await refreshPulseUserFromServer();
      refresh();
    } finally {
      setAccessPolicySaving(false);
    }
  }

  async function saveExtraModules() {
    if (!profileId || !profile || !isTenantFullAdmin || principalHasAnyRole(profile, "company_admin")) return;
    setProfileBusy(true);
    try {
      await patchWorker(apiCompany, profileId, { feature_allow_extra: extraModulesDraft });
      await loadProfile();
      await loadList();
      await refreshPulseUserFromServer();
      refresh();
    } finally {
      setProfileBusy(false);
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

  async function saveProfileHr() {
    if (!profileId || !profile || !canEditWorkerBasics) return;
    const payload: Record<string, unknown> = {};
    const trim = (s: string) => s.trim();
    if (trim(basicDraft.full_name) !== (profile.full_name ?? "").trim()) {
      payload.full_name = trim(basicDraft.full_name) || null;
    }
    if (isTenantFullAdmin && trim(basicDraft.email).toLowerCase() !== profile.email.trim().toLowerCase()) {
      if (!trim(basicDraft.email)) {
        window.alert("Email cannot be empty.");
        return;
      }
      payload.email = trim(basicDraft.email).toLowerCase();
    }
    if (trim(basicDraft.phone) !== (profile.phone ?? "").trim()) {
      payload.phone = trim(basicDraft.phone) || null;
    }
    const curStart = profile.start_date ? profile.start_date.slice(0, 10) : "";
    if (basicDraft.start_date.trim() !== curStart) {
      payload.start_date = basicDraft.start_date.trim() || null;
    }
    const curEmp = normalizeEmploymentDraft(profile.employment_type);
    if (basicDraft.employment_type !== curEmp) {
      payload.employment_type = basicDraft.employment_type || null;
    }
    if (trim(positionDraft.job_title) !== (profile.job_title ?? "").trim()) {
      payload.job_title = trim(positionDraft.job_title) || null;
    }
    if (trim(positionDraft.department) !== (profile.department ?? "").trim()) {
      payload.department = trim(positionDraft.department) || null;
    }
    if (trim(positionDraft.shift) !== (profile.shift ?? "").trim()) {
      payload.shift = trim(positionDraft.shift) || null;
    }
    const sid = trim(positionDraft.supervisor_id);
    const curSid = profile.supervisor_id ?? "";
    if (sid !== curSid) {
      payload.supervisor_id = sid || null;
    }
    const rotationSelected = rotationDaysDraft.some(Boolean);
    const win = { start: padHm(shiftTimeDraft.start), end: padHm(shiftTimeDraft.end) };
    if (rotationSelected && parseTimeToMinutes(win.start) === parseTimeToMinutes(win.end)) {
      window.alert("Shift start and end cannot be the same. For overnight shifts use a later start and earlier end (e.g. 22:00–06:00).");
      return;
    }
    const nextRotation = buildRecurringRowsForDays(rotationDaysDraft, win);
    const prevRotation = recurringRowsFromApi(profile.recurring_shifts ?? []);
    if (canonicalRecurringJson(prevRotation) !== canonicalRecurringJson(nextRotation)) {
      payload.recurring_shifts = nextRotation;
    }
    if (Object.keys(payload).length === 0) return;
    setProfileBusy(true);
    try {
      await patchWorker(apiCompany, profileId, payload);
      await loadProfile();
      await loadList();
      await refreshPulseUserFromServer();
      refresh();
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
    if (!profileId || !profile || !isTenantFullAdmin) return;
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
    if (!effectiveCompanyId || !isTenantFullAdmin) return;
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
      setContractFeatureNamesFromApi(r.contract_feature_names ?? []);
      setFullSettings(r.settings);
      setSettingsDraft(r.settings);
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
        employment_type: createForm.employment_type || null,
        department: createForm.department.trim() || null,
        shift: createForm.shift || null,
        start_date: createForm.start_date || null,
        supervisor_id: createForm.supervisor_id.trim() || null,
        skills: skills.length ? skills : undefined,
        certifications: certifications.length ? certifications : undefined,
      });
      const absLink = `${origin}${result.invite_link_path}`;
      if (result.invite_email_sent === false) {
        setInviteNotice({ inviteUrl: absLink, variant: "no_email" });
      } else if (result.invite_email_sent === null) {
        setInviteNotice({ inviteUrl: absLink, variant: "email_maybe" });
      } else {
        setInviteNotice(null);
      }
      setCreateOpen(false);
      setCreateForm({ ...CREATE_FORM_EMPTY });
      setCreateToast({ variant: "success", message: "Invite sent successfully" });
      await loadList();
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

  if (!canOpenWorkers) {
    return (
      <p className="text-sm text-pulse-muted">
        You do not have access to Team Management. A company administrator can enable it for your role under Team
        Management → Edit roles → “Who can open this page” (managers, supervisors, or leads).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="Manage personnel, roles, permissions, and operational readiness."
        icon={Shield}
        actions={
          <>
            <button
              type="button"
              className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5")}
              onClick={() => {
                setSettingsDraft({ ...fullSettings });
                setCertRulesText(JSON.stringify(fullSettings.certification_rules ?? [], null, 2));
                setSettingsOpen(true);
              }}
              disabled={!dataEnabled || !isTenantFullAdmin}
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

      {dataEnabled ? (
        <p className="max-w-3xl text-sm leading-relaxed text-ds-muted">
          If noreply invite emails are delayed or blocked, use{" "}
          <span className="font-semibold text-ds-foreground">Join link</span> on someone with{" "}
          <span className="font-semibold text-ds-foreground">Invited</span> status to copy a fresh activation URL
          without sending another email from Pulse.
        </p>
      ) : null}

      {createToast ? (
        <div
          role="status"
          className={`ds-notification fixed bottom-6 left-1/2 z-[95] flex max-w-md -translate-x-1/2 items-center gap-2 px-4 py-3 text-sm font-medium ${
            createToast.variant === "success"
              ? "ds-notification-success text-ds-foreground"
              : "border-ds-danger bg-ds-danger text-[var(--ds-on-accent)]"
          }`}
        >
          {createToast.variant === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-ds-success" aria-hidden />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-[var(--ds-on-accent)]" aria-hidden />
          )}
          {createToast.message}
        </div>
      ) : null}

      {inviteNotice ? (
        <div
          className="ds-notification ds-notification-success overflow-hidden text-ds-foreground"
          role="status"
        >
          <div className="flex min-w-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex min-w-0 gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ds-success" strokeWidth={2} aria-hidden />
              <div className="min-w-0 space-y-2">
                  <p className="text-base font-bold leading-snug tracking-tight text-ds-foreground">
                    {inviteNotice.variant === "no_email"
                      ? "Invite created — email not sent from server"
                      : inviteNotice.variant === "link_only"
                        ? "Join link ready"
                        : "Invite queued"}
                  </p>
                  <p className="text-sm leading-relaxed text-ds-muted">
                    {inviteNotice.variant === "no_email"
                      ? "Outbound email is not configured. Copy the join link below and send it to the person directly."
                      : inviteNotice.variant === "link_only"
                        ? "No invite email was sent for this action. Copy the URL below and send it yourself (personal email, SMS, etc.). This is a new activation link—any older link for this person no longer works."
                        : "If outbound email is configured, they should receive the invite shortly. You can still share the link below as a backup."}
                  </p>
                  <div className="pt-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Join link</p>
                    <p className="mt-1 break-all font-mono text-xs leading-relaxed text-ds-muted [word-break:break-word]">
                      {inviteNotice.inviteUrl}
                    </p>
                  </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch sm:pt-1">
              <button
                type="button"
                className={cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex items-center justify-center gap-2 px-3 py-2 text-xs")}
                onClick={() => {
                  void navigator.clipboard.writeText(inviteNotice.inviteUrl).then(() => {
                    setInviteLinkCopied(true);
                    window.setTimeout(() => setInviteLinkCopied(false), 2000);
                  });
                }}
              >
                {inviteLinkCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    Copy link
                  </>
                )}
              </button>
              <button
                type="button"
                className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-xs")}
                onClick={() => {
                  setInviteNotice(null);
                  setInviteLinkCopied(false);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSystemAdmin ? (
        <Card variant="secondary" padding="md" className="mt-6">
          <label className={`block ${dsLabelClass}`}>Company</label>
          <select
            className={`${dsSelectClass} mt-1.5 max-w-md md:w-auto`}
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
        </Card>
      ) : null}

      {!dataEnabled ? (
        <p className="mt-8 text-sm text-pulse-muted">
          {isSystemAdmin ? "Select a company to continue." : "Unable to resolve organization."}
        </p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-4 xl:col-span-3">
            {isTenantFullAdmin && contractCatalog.length > 0 ? (
              <Card variant="secondary" padding="md">
                <h2 className="text-sm font-bold tracking-tight text-ds-foreground">Delegate Workers &amp; Roles page</h2>
                <p className="mt-1 text-xs text-ds-muted">
                  By default only company admins use this page. Allow operational roles to manage roster and invites.
                </p>
                <div className="mt-4 space-y-2">
                  {(
                    [
                      ["manager", "Managers"],
                      ["supervisor", "Supervisors"],
                      ["lead", "Leads"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-ds-foreground">
                      <input
                        type="checkbox"
                        className={dsCheckboxClass}
                        checked={delegationDraft[key as keyof typeof delegationDraft]}
                        onChange={(e) =>
                          setDelegationDraft((d) => ({ ...d, [key]: e.target.checked }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </Card>
            ) : null}

            {isTenantFullAdmin && contractCatalog.length > 0 ? (
              <Card variant="secondary" padding="md">
                <h2 className="text-sm font-bold tracking-tight text-ds-foreground">Permissions</h2>
                <p className="mt-1 text-xs text-ds-muted">
                  Your organization&apos;s Pulse modules come from the contract (set by the system admin). Pick a role,
                  then turn contract modules on or off for people in that role.
                </p>
                <label className={`${LABEL} mt-4 block`}>Role</label>
                <select
                  className={FIELD}
                  value={permissionsRole}
                  onChange={(e) => setPermissionsRole(e.target.value as PermissionRole)}
                >
                  {PERMISSION_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {humanizeRole(role)}
                    </option>
                  ))}
                </select>
                <div className="mt-4 space-y-3">
                  {TENANT_PRODUCT_MODULES.filter((m) => contractCatalog.includes(m)).map((mod) => {
                    const on = (roleFeatureAccessDraft[permissionsRole] ?? []).includes(mod);
                    return (
                      <div
                        key={`${permissionsRole}-${mod}`}
                        className="ds-inset-panel flex items-center justify-between gap-3 px-3 py-3"
                      >
                        <p className="min-w-0 text-sm font-semibold text-ds-foreground">{MODULE_LABEL[mod] ?? mod}</p>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          disabled={!isTenantFullAdmin}
                          onClick={() =>
                            isTenantFullAdmin ? toggleRoleModule(permissionsRole, mod) : undefined
                          }
                          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                            on ? "bg-ds-success" : "bg-ds-border"
                          } disabled:opacity-45`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-ds-primary shadow transition-transform ${
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
                  disabled={accessPolicySaving}
                  onClick={() => void saveAccessPolicy()}
                >
                  {accessPolicySaving ? "Saving…" : "Save permissions"}
                </button>
                <div className="ds-inset-panel mt-4 px-3 py-2 text-xs text-ds-muted">
                  Changes apply to all users with the {humanizeRole(permissionsRole)} role after you save.
                </div>
              </Card>
            ) : null}

            {isTenantFullAdmin ? (
              <Card variant="secondary" padding="md">
                <h2 className="text-sm font-bold tracking-tight text-ds-foreground">Procedure editing</h2>
                <p className="mt-1 text-xs text-ds-muted">
                  Choose which roles can edit procedures. Procedure creators can always edit their own procedures.
                </p>
                <div className="mt-4 space-y-2">
                  {PERMISSION_ROLE_OPTIONS.map((role) => {
                    const on = proceduresEditRolesDraft.includes(role);
                    return (
                      <label key={role} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-ds-foreground">
                        <span className="font-semibold">{humanizeRole(role)}</span>
                        <input
                          type="checkbox"
                          className={dsCheckboxClass}
                          checked={on}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setProceduresEditRolesDraft((prev) => {
                              const set = new Set(prev);
                              if (next) set.add(role);
                              else set.delete(role);
                              return [...set];
                            });
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-ds-muted">
                  Company admins can always edit procedures.
                </p>
              </Card>
            ) : null}

            {isTenantFullAdmin ? (
              <Card variant="secondary" padding="md">
                <h2 className="text-sm font-bold tracking-tight text-ds-foreground">Work request editing</h2>
                <p className="mt-1 text-xs text-ds-muted">
                  Who may change assignee, location (zone), category, due date, and other fields on an existing request.
                  The person who submitted the request may always edit it; company admins always may.
                </p>
                <div className="mt-4 space-y-2">
                  {PERMISSION_ROLE_OPTIONS.map((role) => {
                    const on = workRequestEditRolesDraft.includes(role);
                    return (
                      <label key={`wr-edit-${role}`} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-ds-foreground">
                        <span className="font-semibold">{humanizeRole(role)}</span>
                        <input
                          type="checkbox"
                          className={dsCheckboxClass}
                          checked={on}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setWorkRequestEditRolesDraft((prev) => {
                              const set = new Set(prev);
                              if (next) set.add(role);
                              else set.delete(role);
                              return [...set];
                            });
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </Card>
            ) : null}

            {isTenantFullAdmin ? (
              <Card variant="secondary" padding="md">
                <h2 className="text-sm font-bold tracking-tight text-ds-foreground">Facility locations (zones)</h2>
                <p className="mt-1 text-xs text-ds-muted">
                  Who may add, rename, or remove locations shown on work requests. Configure lists under Maintenance → Work
                  requests → Manage locations.
                </p>
                <div className="mt-4 space-y-2">
                  {PERMISSION_ROLE_OPTIONS.map((role) => {
                    const on = zoneManageRolesDraft.includes(role);
                    return (
                      <label key={`zone-${role}`} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-ds-foreground">
                        <span className="font-semibold">{humanizeRole(role)}</span>
                        <input
                          type="checkbox"
                          className={dsCheckboxClass}
                          checked={on}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setZoneManageRolesDraft((prev) => {
                              const set = new Set(prev);
                              if (next) set.add(role);
                              else set.delete(role);
                              return [...set];
                            });
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </Card>
            ) : null}

            {isTenantFullAdmin ? null : (
              <p className="ds-inset-panel px-3 py-2 text-xs text-ds-muted">
                Workers settings and contract-scoped module access are managed by a company administrator.
              </p>
            )}
          </div>

          <div className="lg:col-span-8 xl:col-span-9">
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
              <input
                type="search"
                placeholder="Search workers or roles…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={`${dsInputClass} py-2 pl-9 pr-3`}
              />
            </div>

            {listLoading ? (
              <div className="flex items-center gap-2 py-16 text-pulse-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading roster…
              </div>
            ) : listError ? (
              <p className="text-sm text-ds-danger">{listError}</p>
            ) : (
              <div className="space-y-5">
                {grouped.map(({ role, items }) =>
                  items.length === 0 ? null : (
                    <Card key={role} variant="secondary" padding="none" className="overflow-hidden shadow-sm">
                      <div className="app-table-head-row px-4 py-2.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">
                          {roleGroupTitle(role)} ({items.length})
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className={dataTableHeadRowClass}>
                              <th className="px-4 py-3">Name</th>
                              <th className="px-4 py-3">Role</th>
                              <th className="px-4 py-3">Shift</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ds-muted">
                                Last active
                              </th>
                              <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ds-muted lg:table-cell">
                                Last sign-in (geo)
                              </th>
                              <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ds-muted lg:table-cell">
                                Browser / device
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((row) => (
                              <tr
                                key={row.id}
                                className={`${dataTableBodyRow()} cursor-pointer`}
                                onClick={() => setProfileId(row.id)}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                    <WorkerRosterFace
                                      avatarUrl={row.avatar_url}
                                      fullName={row.full_name}
                                      email={row.email}
                                    />
                                    <div className="min-w-0">
                                      <p className="font-semibold text-ds-foreground">
                                        {row.full_name ?? row.email.split("@")[0]}
                                      </p>
                                      <p className="truncate text-xs text-ds-muted">{row.email}</p>
                                    </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      {(row.account_status ?? "active") === "invited" ? (
                                        <button
                                          type="button"
                                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ds-border bg-ds-primary text-ds-foreground transition-colors hover:bg-ds-secondary disabled:opacity-50 dark:bg-ds-secondary"
                                          aria-label="Copy join link without sending email"
                                          title="Copy join link (no email). New link; older invite links stop working."
                                          disabled={Boolean(inviteLinkBusyId) || profileBusy}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void obtainInvitedWorkerJoinLink(row.id, false);
                                          }}
                                        >
                                          {inviteLinkBusyId === row.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                          ) : (
                                            <Link2 className="h-4 w-4" aria-hidden />
                                          )}
                                        </button>
                                      ) : null}
                                      {canDeleteInvitedFromList && (row.account_status ?? "active") === "invited" ? (
                                        <button
                                          type="button"
                                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ds-danger/40 bg-[color-mix(in_srgb,var(--ds-danger)_8%,transparent)] text-ds-danger transition-colors hover:bg-[color-mix(in_srgb,var(--ds-danger)_14%,transparent)] disabled:opacity-50"
                                          aria-label="Delete invited worker"
                                          title="Delete invited worker"
                                          disabled={profileBusy}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void deleteInvitedWorkerFromList(row);
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" aria-hidden />
                                        </button>
                                      ) : null}
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
                                <td className="px-4 py-3 text-sm text-ds-foreground">
                                  {shiftRosterLabel(row.shift, fullSettings.shifts)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center gap-1.5 text-sm text-ds-foreground">
                                    <span
                                      className={`h-2 w-2 rounded-full ${
                                        (row.account_status ?? "active") === "invited"
                                          ? "bg-ds-warning"
                                          : row.is_active
                                            ? "bg-ds-success"
                                            : "bg-ds-border"
                                      }`}
                                    />
                                    {(row.account_status ?? "active") === "invited"
                                      ? "Invited"
                                      : row.is_active
                                        ? "Active"
                                        : "Inactive"}
                                  </span>
                                </td>
                                <td className="max-w-[10rem] px-4 py-3 text-xs text-ds-muted">
                                  {formatLoginWhen(row.last_active_at)}
                                </td>
                                <td className="hidden max-w-[12rem] px-4 py-3 text-xs text-ds-muted lg:table-cell">
                                  {formatLoginPlace(row)}
                                </td>
                                <td className="hidden max-w-[14rem] px-4 py-3 text-xs text-ds-muted lg:table-cell">
                                  <span className="line-clamp-2" title={row.last_login_user_agent ?? ""}>
                                    {shortenUa(row.last_login_user_agent)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
        placement="center"
        labelledBy="worker-create-title"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-ds-muted transition-colors hover:text-ds-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
            <label className={LABEL}>Employment type</label>
            <select
              className={FIELD}
              value={createForm.employment_type}
              onChange={(e) =>
                setCreateForm((f) => ({
                  ...f,
                  employment_type: e.target.value as CreateFormState["employment_type"],
                }))
              }
            >
              <option value="full_time">Full time</option>
              <option value="regular_part_time">Regular part time</option>
              <option value="part_time">Part time</option>
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
        onClose={() => {
          setProfileId(null);
          clearProfileQueryFromUrl();
        }}
        belowAppHeader
        wide
        elevated
        labelledBy="worker-profile-title"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-3">
            {(profile?.account_status ?? "active") === "invited" ? (
              <>
                <button
                  type="button"
                  className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5 text-sm")}
                  disabled={profileBusy || inviteLinkBusyId === profileId}
                  onClick={() => {
                    if (!profileId) return;
                    void obtainInvitedWorkerJoinLink(profileId, true);
                  }}
                >
                  {inviteLinkBusyId === profileId ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Working…
                    </span>
                  ) : (
                    "Resend invite"
                  )}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-ds-border bg-ds-primary px-4 py-2.5 text-sm font-semibold text-ds-foreground shadow-sm hover:bg-ds-secondary disabled:opacity-50 dark:bg-ds-secondary"
                  disabled={profileBusy || inviteLinkBusyId === profileId}
                  onClick={() => {
                    if (!profileId) return;
                    void obtainInvitedWorkerJoinLink(profileId, false);
                  }}
                  title="Copy a join link without sending email. Creates a new link; older links stop working."
                >
                  <Link2 className="h-4 w-4 shrink-0" aria-hidden />
                  Copy join link
                </button>
              </>
            ) : null}
            {canEditWorkerBasics ? (
              <button
                type="button"
                className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5 text-sm font-semibold")}
                disabled={profileBusy}
                onClick={() => void saveProfileHr()}
              >
                {profileBusy ? "Saving…" : "Save profile details"}
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
              <h3 className={SECTION_KICKER}>Basic info</h3>
              <p className="mt-1 max-w-prose text-xs text-pulse-muted">
                Changes here update this person&apos;s roster record for Pulse (schedule assignments, projects, device
                ownership where linked by user, and permissions).
              </p>
              <div className="mt-3 flex items-center gap-3 sm:col-span-2">
                <UserProfileAvatarPreview
                  avatarUrl={profile.avatar_url}
                  nameFallback={profile.full_name || profile.email}
                  sizeClassName="h-16 w-16"
                  fallback="initials"
                />
              </div>
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
                  <span className="font-medium text-ds-foreground">
                    {(profile.account_status ?? "active") === "invited"
                      ? "Invited (pending activation)"
                      : profile.is_active
                        ? "Active"
                        : "Inactive"}
                  </span>
                </p>
                {canEditWorkerBasics ? (
                  <>
                    <div className="sm:col-span-2">
                      <label className={LABEL} htmlFor="worker-profile-full-name">
                        Display name
                      </label>
                      <input
                        id="worker-profile-full-name"
                        className={FIELD}
                        value={basicDraft.full_name}
                        onChange={(e) => setBasicDraft((d) => ({ ...d, full_name: e.target.value }))}
                        autoComplete="name"
                      />
                    </div>
                    {isTenantFullAdmin ? (
                      <div className="sm:col-span-2">
                        <label className={LABEL} htmlFor="worker-profile-email">
                          Email
                        </label>
                        <input
                          id="worker-profile-email"
                          type="email"
                          className={FIELD}
                          value={basicDraft.email}
                          onChange={(e) => setBasicDraft((d) => ({ ...d, email: e.target.value }))}
                          autoComplete="email"
                        />
                        <p className="mt-1 text-xs text-pulse-muted">
                          This is the address they use to sign in; changing it updates their login identity.
                        </p>
                      </div>
                    ) : (
                      <p className="sm:col-span-2">
                        <span className="text-pulse-muted">Email: </span>
                        {profile.email}
                      </p>
                    )}
                    <div>
                      <label className={LABEL} htmlFor="worker-profile-phone">
                        Phone
                      </label>
                      <input
                        id="worker-profile-phone"
                        type="tel"
                        className={FIELD}
                        value={basicDraft.phone}
                        onChange={(e) => setBasicDraft((d) => ({ ...d, phone: e.target.value }))}
                        autoComplete="tel"
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="worker-profile-start">
                        Start date
                      </label>
                      <input
                        id="worker-profile-start"
                        type="date"
                        className={FIELD}
                        value={basicDraft.start_date}
                        onChange={(e) => setBasicDraft((d) => ({ ...d, start_date: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={LABEL} htmlFor="worker-profile-employment">
                        Employment status
                      </label>
                      <select
                        id="worker-profile-employment"
                        className={FIELD}
                        value={basicDraft.employment_type}
                        onChange={(e) =>
                          setBasicDraft((d) => ({
                            ...d,
                            employment_type: e.target.value as EmploymentTypeKey,
                          }))
                        }
                      >
                        <option value="">— Not set —</option>
                        <option value="full_time">Full time</option>
                        <option value="regular_part_time">Regular part time</option>
                        <option value="part_time">Part time</option>
                      </select>
                      <p className="mt-1 text-xs text-pulse-muted">
                        Used on the schedule roster and worker profile; matches invite defaults when left unset.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
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
                    <p className="sm:col-span-2">
                      <span className="text-pulse-muted">Employment: </span>
                      {normalizeEmploymentDraft(profile.employment_type) === "full_time"
                        ? "Full time"
                        : normalizeEmploymentDraft(profile.employment_type) === "regular_part_time"
                          ? "Regular part time"
                          : normalizeEmploymentDraft(profile.employment_type) === "part_time"
                            ? "Part time"
                            : "—"}
                    </p>
                  </>
                )}
              </div>
            </section>

            {isTenantFullAdmin && !principalHasAnyRole(profile, "company_admin") ? (
              <section>
                <h3 className={SECTION_KICKER}>Edit roles</h3>
                <p className="mt-1 text-xs text-pulse-muted">
                  Select every role this person should have for scheduling, supervision, and permissions. At least one
                  role is required.
                </p>
                <div className="ds-inset-panel mt-3 space-y-2 p-3">
                  {PROFILE_ROLE_OPTIONS.map((key) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-ds-foreground">
                      <input
                        type="checkbox"
                        className={dsCheckboxClass}
                        checked={profileRolesDraft.includes(key)}
                        onChange={(e) => toggleProfileRole(key, e.target.checked)}
                      />
                      {humanizeRole(key)}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "mt-3 px-4 py-2 text-sm font-semibold")}
                  disabled={profileBusy}
                  onClick={() => void saveProfileRoles()}
                >
                  {profileBusy ? "Saving…" : "Save roles"}
                </button>
              </section>
            ) : null}

            {isTenantFullAdmin && !principalHasAnyRole(profile, "company_admin") && contractCatalog.length > 0 ? (
              <section>
                <h3 className={SECTION_KICKER}>Extra module access</h3>
                <p className="mt-1 text-xs text-pulse-muted">
                  Grant additional Pulse modules from your organization&apos;s contract (on top of this person&apos;s
                  role defaults).
                </p>
                <div className="ds-inset-panel mt-3 flex flex-col gap-1.5 p-3">
                  {TENANT_PRODUCT_MODULES.filter((m) => contractCatalog.includes(m)).map((mod) => (
                    <label key={mod} className="flex cursor-pointer items-center gap-2 text-sm text-ds-foreground">
                      <input
                        type="checkbox"
                        className={dsCheckboxClass}
                        checked={extraModulesDraft.includes(mod)}
                        onChange={(e) => {
                          setExtraModulesDraft((prev) =>
                            e.target.checked ? [...new Set([...prev, mod])].sort() : prev.filter((x) => x !== mod),
                          );
                        }}
                      />
                      {MODULE_LABEL[mod] ?? mod}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "mt-3 px-4 py-2 text-sm font-semibold")}
                  disabled={profileBusy}
                  onClick={() => void saveExtraModules()}
                >
                  {profileBusy ? "Saving…" : "Save module access"}
                </button>
              </section>
            ) : null}

            <section>
              <h3 className={SECTION_KICKER}>Position &amp; shift</h3>
              {canEditWorkerBasics ? (
                <div className="mt-2 grid gap-4 text-sm sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={LABEL} htmlFor="worker-profile-job-title">
                      Job title
                    </label>
                    <input
                      id="worker-profile-job-title"
                      className={FIELD}
                      value={positionDraft.job_title}
                      onChange={(e) => setPositionDraft((d) => ({ ...d, job_title: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={LABEL} htmlFor="worker-profile-department">
                      Department
                    </label>
                    <input
                      id="worker-profile-department"
                      className={FIELD}
                      value={positionDraft.department}
                      onChange={(e) => setPositionDraft((d) => ({ ...d, department: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="worker-profile-shift">
                      Shift
                    </label>
                    <select
                      id="worker-profile-shift"
                      className={FIELD}
                      value={positionDraft.shift}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPositionDraft((d) => ({ ...d, shift: v }));
                        const preset = shiftWindowFromRosterKey(v, fullSettings.shifts ?? []);
                        setShiftTimeDraft({ start: padHm(preset.start), end: padHm(preset.end) });
                      }}
                    >
                      <option value="">—</option>
                      {(fullSettings.shifts ?? []).map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-pulse-muted">
                      Choosing a shift preset fills typical start/end below; adjust the times for an exact window.
                    </p>
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="worker-profile-supervisor">
                      Supervisor
                    </label>
                    <select
                      id="worker-profile-supervisor"
                      className={FIELD}
                      value={positionDraft.supervisor_id}
                      onChange={(e) => setPositionDraft((d) => ({ ...d, supervisor_id: e.target.value }))}
                    >
                      <option value="">—</option>
                      {profile.supervisor_id &&
                      !profileSupervisorOptions.some((s) => s.id === profile.supervisor_id) ? (
                        <option value={profile.supervisor_id}>
                          {profile.supervisor_name?.trim() || "Current supervisor (unavailable)"}
                        </option>
                      ) : null}
                      {profileSupervisorOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {(s.full_name ?? s.email) +
                            ` (${sortRolesForDisplay(s.roles?.length ? s.roles : [s.role])
                              .map((x) => humanizeRole(x))
                              .join(", ")})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                    <div>
                      <label className={LABEL} htmlFor="worker-profile-shift-start">
                        Shift start
                      </label>
                      <input
                        id="worker-profile-shift-start"
                        type="time"
                        className={FIELD}
                        value={shiftTimeDraft.start}
                        onChange={(e) => setShiftTimeDraft((t) => ({ ...t, start: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="worker-profile-shift-end">
                        Shift end
                      </label>
                      <input
                        id="worker-profile-shift-end"
                        type="time"
                        className={FIELD}
                        value={shiftTimeDraft.end}
                        onChange={(e) => setShiftTimeDraft((t) => ({ ...t, end: e.target.value }))}
                      />
                    </div>
                    <p className="text-xs text-pulse-muted sm:col-span-2">
                      Used for weekly rotation blocks and schedule labels (same clock times group as D1, D2, A1… on
                      each day). Overnight: end earlier on the clock than start (e.g. 22:00 → 06:00).
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className={LABEL}>Weekly rotation (schedule)</span>
                    <p className="mt-1 text-xs text-pulse-muted">
                      Choose weekdays for this worker&apos;s repeating pattern. Hours use the shift start/end above.
                      Fills the schedule when they have no other assignment that day.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ROTATION_PRESET_BUTTONS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          className="rounded-md border border-ds-border bg-ds-card px-2.5 py-1 text-xs font-medium text-ds-foreground hover:bg-ds-muted/30"
                          onClick={() => setRotationDaysDraft([...p.days])}
                        >
                          {p.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="rounded-md border border-ds-border px-2.5 py-1 text-xs font-medium text-pulse-muted hover:bg-ds-muted/30"
                        onClick={() => setRotationDaysDraft([...EMPTY_ROTATION_DAYS])}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {ROTATION_WEEKDAY_SHORT.map((label, i) => (
                        <label
                          key={label}
                          className="flex cursor-pointer items-center gap-1.5 text-sm text-ds-foreground"
                        >
                          <input
                            type="checkbox"
                            className={dsCheckboxClass}
                            checked={rotationDaysDraft[i] ?? false}
                            onChange={() =>
                              setRotationDaysDraft((prev) => {
                                const next = [...prev];
                                next[i] = !next[i];
                                return next;
                              })
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
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
                    {shiftRosterLabel(profile.shift, fullSettings.shifts)}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-pulse-muted">Shift hours: </span>
                    {(() => {
                      const rows = recurringRowsFromApi(profile.recurring_shifts ?? []);
                      if (rows.length && rows.every((r) => r.start === rows[0]!.start && r.end === rows[0]!.end)) {
                        return `${padHm(rows[0]!.start)}–${padHm(rows[0]!.end)}`;
                      }
                      const w = shiftWindowFromRosterKey(profile.shift ?? "", fullSettings.shifts ?? []);
                      return `${padHm(w.start)}–${padHm(w.end)} (preset from roster shift)`;
                    })()}
                  </p>
                  <p>
                    <span className="text-pulse-muted">Supervisor: </span>
                    {profile.supervisor_name ?? "—"}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-pulse-muted">Weekly rotation: </span>
                    {formatRotationReadOnly(profile)}
                  </p>
                </div>
              )}
            </section>

            <section>
              <h3 className={SECTION_KICKER}>Certifications</h3>
              <ul className="mt-2 space-y-2">
                {profile.certifications.length === 0 ? (
                  <li className="text-sm text-pulse-muted">None on file.</li>
                ) : (
                  profile.certifications.map((c) => (
                    <li
                      key={c.id}
                      className="ds-inset-panel flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="font-medium text-ds-foreground">{c.name}</span>
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
              <h3 className={SECTION_KICKER}>Specialty training</h3>
              <ul className="mt-2 space-y-1 text-sm text-ds-foreground">
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
              <h3 className={SECTION_KICKER}>Skill affinities</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.skills.length === 0 ? (
                  <span className="text-sm text-pulse-muted">None tagged.</span>
                ) : (
                  profile.skills.map((s) => (
                    <span
                      key={s.id}
                      className="app-badge-slate rounded-full px-3 py-1 text-xs font-semibold"
                    >
                      {s.name} · L{s.level}
                    </span>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className={SECTION_KICKER}>Compliance summary</h3>
              <div className="ds-inset-panel mt-2 grid gap-2 p-4 text-sm sm:grid-cols-2 text-ds-foreground">
                <p>
                  Compliance rate:{" "}
                  <span className="font-bold text-ds-foreground">{profile.compliance_summary.compliance_rate_pct}%</span>
                </p>
                <p>Missed acknowledgments: {profile.compliance_summary.missed_acknowledgments}</p>
                <p>Flags: {profile.compliance_summary.flagged_count}</p>
                <p>
                  Repeat offender:{" "}
                  {profile.compliance_summary.repeat_offender ? (
                    <span className="font-semibold text-ds-danger">Yes</span>
                  ) : (
                    <span className="text-ds-muted">No</span>
                  )}
                </p>
              </div>
            </section>

            <section>
              <h3 className={SECTION_KICKER}>Work activity</h3>
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

            {isTenantFullAdmin || canDeactivateProfile ? (
              <section>
                <h3 className={SECTION_KICKER}>Account</h3>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {isTenantFullAdmin ? (
                    <button
                      type="button"
                      className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2 text-sm font-semibold")}
                      onClick={() =>
                        void openLoginActivity({
                          id: profile.id,
                          full_name: profile.full_name,
                          email: profile.email,
                        })
                      }
                    >
                      View login activity
                    </button>
                  ) : null}
                  {canDeactivateProfile && profile.is_active ? (
                    <button
                      type="button"
                      className="rounded-lg border border-ds-danger/40 bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)] px-4 py-2 text-sm font-semibold text-ds-danger hover:brightness-95"
                      disabled={profileBusy}
                      onClick={() => void setProfileActive(false)}
                    >
                      Deactivate user
                    </button>
                  ) : null}
                  {canDeactivateProfile && !profile.is_active ? (
                    <button
                      type="button"
                      className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2 text-sm font-semibold")}
                      disabled={profileBusy}
                      onClick={() => void setProfileActive(true)}
                    >
                      Reactivate user
                    </button>
                  ) : null}
                  {canDeleteWorkerProfile ? (
                    <button
                      type="button"
                      className="rounded-lg border border-ds-danger/50 bg-[color-mix(in_srgb,var(--ds-danger)_8%,transparent)] px-4 py-2 text-sm font-semibold text-ds-danger transition-colors hover:bg-[color-mix(in_srgb,var(--ds-danger)_14%,transparent)] disabled:opacity-50"
                      disabled={profileBusy}
                      onClick={() => void removeWorkerProfilePermanently()}
                    >
                      Delete user permanently
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-ds-muted">
                  Deactivated users cannot sign in. Company administrators can restore access; another company admin
                  cannot be changed here.
                  {canDeleteWorkerProfile
                    ? " Permanent delete removes the account from your tenant (not available for company administrators)."
                    : null}
                </p>
              </section>
            ) : null}

            <section>
              <h3 className={SECTION_KICKER}>Notes / supervisor comments</h3>
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
        open={Boolean(activityUserId)}
        title="Login activity"
        subtitle={activityLabel ? `Recorded sign-ins for ${activityLabel}` : "Recorded sign-ins"}
        onClose={() => {
          setActivityUserId(null);
          setActivityRows([]);
          setActivityError(null);
        }}
        belowAppHeader
        wide
      >
        <div className="space-y-4">
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
            <div className="overflow-x-auto rounded-lg border border-ds-border">
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
                      <td className="px-3 py-2 text-ds-foreground">{formatLoginWhen(ev.timestamp)}</td>
                      <td className="px-3 py-2 text-ds-muted">{ev.ip_address}</td>
                      <td className="px-3 py-2 text-ds-muted">
                        {[ev.city, ev.region].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="max-w-[18rem] px-3 py-2 break-all text-ds-muted">{ev.user_agent || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </PulseDrawer>

      <PulseDrawer
        open={settingsOpen}
        title="Workers configuration"
        subtitle="Roles, shifts, skill categories, and certification rules"
        onClose={() => setSettingsOpen(false)}
        belowAppHeader
        wide
        elevated
        placement="center"
        labelledBy="workers-settings-title"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-ds-muted hover:text-ds-foreground"
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
            <div className="mt-1.5 flex flex-wrap gap-1 rounded-[10px] border border-ds-border bg-ds-secondary p-1">
              {SETTINGS_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSettingsTab(t)}
                  className={`rounded-lg px-2.5 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
                    settingsTab === t
                      ? "bg-ds-primary text-ds-success shadow-sm ring-1 ring-ds-border"
                      : "text-ds-muted hover:bg-ds-primary"
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
