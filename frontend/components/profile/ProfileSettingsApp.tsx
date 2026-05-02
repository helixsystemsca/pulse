"use client";

import { Building2, Loader2, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CompanyLogo } from "@/components/branding/CompanyLogo";
import { useTheme } from "@/components/theme/ThemeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { UserProfileAvatarPreview } from "@/components/profile/UserProfileAvatarPreview";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { apiFetch, refreshPulseUserFromServer } from "@/lib/api";
import { uploadTenantCompanyLogoFile } from "@/lib/companyBrandingUpload";
import { replayNonAdminOnboardingTour } from "@/lib/onboarding-events";
import { getImpersonationOverlayAccessToken } from "@/lib/impersonation-overlay-token";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { uploadProfileAvatarFile } from "@/lib/profileAvatarUpload";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import type { CompanySummary } from "@/lib/pulse-session";
import { listProcedureAcknowledgments } from "@/lib/procedureAcknowledgments";
import { ProfileGamificationPanel } from "@/components/gamification/ProfileGamificationPanel";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:placeholder:text-gray-500";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";
const CARD =
  "rounded-md border border-pulse-border bg-white p-5 shadow-sm ring-1 ring-slate-100/80 dark:border-ds-border dark:bg-ds-primary dark:ring-white/[0.06] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]";
const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex items-center justify-center gap-2 px-5 py-2.5");
const SECONDARY = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5");

const OP_ROLES = ["worker", "manager", "supervisor"] as const;

export function ProfileSettingsApp() {
  const { session, refresh } = usePulseAuth();
  const { theme } = useTheme();
  const avatarRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [participate, setParticipate] = useState(false);
  const [opRole, setOpRole] = useState<string>("worker");

  const [company, setCompany] = useState<CompanySummary | null>(null);
  const [coName, setCoName] = useState("");
  const [coTz, setCoTz] = useState("");
  const [coIndustry, setCoIndustry] = useState("");

  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isCompanyAdmin = session ? sessionHasAnyRole(session, "company_admin") : false;
  const [procedureAcks, setProcedureAcks] = useState<{ procedure_id: string; procedure_title: string; signed_at: string }[]>(
    [],
  );
  const syncFromSession = useCallback(() => {
    if (!session) return;
    setFullName(session.full_name ?? "");
    setEmail(session.email ?? "");
    setJobTitle(session.job_title ?? "");
    setAvatarUrl(session.avatar_url ?? null);
    const op = session.operational_role?.trim() || "";
    setParticipate(Boolean(op));
    setOpRole(OP_ROLES.includes(op as (typeof OP_ROLES)[number]) ? op : "worker");
    const c = session.company ?? null;
    setCompany(c);
    if (c) {
      setCoName(c.name ?? "");
      setCoTz(c.timezone ?? "");
      setCoIndustry(c.industry ?? "");
    }
  }, [session]);

  useEffect(() => {
    syncFromSession();
  }, [syncFromSession]);

  useEffect(() => {
    if (!session?.sub) return;
    setProcedureAcks(listProcedureAcknowledgments(session.sub));
  }, [session?.sub]);

  useEffect(() => {
    void refreshPulseUserFromServer();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function onSave() {
    if (!session?.access_token) return;
    setErr(null);
    setSaving(true);
    try {
      await apiFetch("/api/v1/profile/settings", {
        method: "PATCH",
        json: {
          full_name: fullName.trim() || null,
          job_title: jobTitle.trim() || null,
          operational_role: participate ? opRole : null,
          ...(isCompanyAdmin
            ? {
                company: {
                  name: coName.trim() || undefined,
                  timezone: coTz.trim() || null,
                  industry: coIndustry.trim() || null,
                },
              }
            : {}),
        },
      });
      await refreshPulseUserFromServer();
      syncFromSession();
      setToast("Settings saved.");
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarFile(f: File | null) {
    if (!f) return;
    setErr(null);
    setAvatarBusy(true);
    try {
      await uploadProfileAvatarFile(f);
      await refreshPulseUserFromServer();
      setAvatarUrl("/api/v1/profile/avatar");
      // `refreshPulseUserFromServer` returns early when the in-memory impersonation overlay is active
      // (no `writeApiSession` → no `pulse-auth-change`). Still bump avatar resolution in that case.
      if (typeof window !== "undefined" && getImpersonationOverlayAccessToken()) {
        window.dispatchEvent(new Event("pulse-auth-change"));
      }
      setToast("Profile photo updated.");
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onLogoFile(f: File | null) {
    if (!f || !isCompanyAdmin) return;
    setErr(null);
    setLogoBusy(true);
    try {
      await uploadTenantCompanyLogoFile(f);
      await refreshPulseUserFromServer();
      if (typeof window !== "undefined" && getImpersonationOverlayAccessToken()) {
        window.dispatchEvent(new Event("pulse-auth-change"));
      }
      setToast("Company logo updated.");
      if (logoRef.current) logoRef.current.value = "";
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setLogoBusy(false);
    }
  }

  if (!session) {
    return (
      <p className="text-sm text-pulse-muted">Sign in to manage your profile.</p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile Settings"
        description="Your account details, organization branding, and workforce participation."
        icon={UserRound}
      />

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[95] max-w-md -translate-x-1/2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg dark:border-emerald-500/35 dark:bg-emerald-950/90 dark:text-emerald-100"
        >
          {toast}
        </div>
      ) : null}

      {err ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
          {err}
        </div>
      ) : null}

      {session.company_id && !isCompanyAdmin ? (
        <section className="ds-card-elevated border border-ds-border p-5 shadow-[var(--ds-shadow-card)]">
          <h2 className="text-sm font-bold text-ds-foreground">Onboarding</h2>
          <p className="mt-1 text-sm text-ds-muted">Replay the short welcome tour whenever you need a refresher.</p>
          <button
            type="button"
            className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "mt-4 px-4 py-2.5 text-sm")}
            onClick={() => void replayNonAdminOnboardingTour(refresh)}
          >
            Replay onboarding
          </button>
        </section>
      ) : null}

      <ProfileGamificationPanel />

      <section className={CARD}>
        <h2 className="text-sm font-bold tracking-tight text-pulse-navy dark:text-slate-100">Profile</h2>
        <p className="mt-1 text-sm text-pulse-muted">Photo, name, and contact details.</p>
        <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-3 sm:items-start">
            <UserProfileAvatarPreview
              avatarUrl={avatarUrl}
              nameFallback={fullName || email}
              sizeClassName="h-28 w-28"
            />
            <input
              ref={avatarRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void onAvatarFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className={SECONDARY}
              disabled={avatarBusy}
              onClick={() => avatarRef.current?.click()}
            >
              {avatarBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Uploading...
                </>
              ) : (
                "Change photo"
              )}
            </button>
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <label className={LABEL} htmlFor="profile-full-name">
                Name
              </label>
              <input
                id="profile-full-name"
                className={FIELD}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="profile-email">
                Email
              </label>
              <input
                id="profile-email"
                className={`${FIELD} bg-slate-50/80 text-pulse-muted dark:bg-[#0B1220]`}
                value={email}
                readOnly
                title="Contact your administrator to change the sign-in email."
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="profile-job">
                Job title <span className="font-normal normal-case text-pulse-muted">(optional)</span>
              </label>
              <input
                id="profile-job"
                className={FIELD}
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Facilities Manager"
              />
            </div>
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className="text-sm font-bold tracking-tight text-pulse-navy dark:text-slate-100">Compliance</h2>
        <p className="mt-1 text-sm text-pulse-muted">Your acknowledgments for procedures and required reads.</p>
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">Procedures acknowledged</h3>
          {procedureAcks.length === 0 ? (
            <p className="mt-2 text-sm text-pulse-muted">No procedure acknowledgments yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-200/80 rounded-md border border-slate-200/90 bg-white/70 text-sm dark:divide-ds-border dark:border-ds-border dark:bg-ds-secondary/40">
              {procedureAcks.map((a) => (
                <li key={`${a.procedure_id}:${a.signed_at}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ds-foreground">{a.procedure_title}</p>
                    <p className="truncate text-xs text-ds-muted">Signed that you read it</p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold text-ds-muted">
                    {new Date(a.signed_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {isCompanyAdmin && company ? (
        <section className={CARD}>
          <div className="flex items-center gap-2 text-pulse-navy dark:text-slate-100">
            <Building2 className="h-5 w-5 text-[#2B4C7E]" aria-hidden />
            <h2 className="text-sm font-bold tracking-tight">Organization</h2>
          </div>
          <p className="mt-1 text-sm text-pulse-muted">
            Company-wide details (visible only to company administrators).
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="co-name">
                Company name
              </label>
              <input id="co-name" className={FIELD} value={coName} onChange={(e) => setCoName(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Company logo</label>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <CompanyLogo
                  logoUrl={company.logo_url ?? null}
                  companyName={coName}
                  variant={theme === "dark" ? "dark" : "light"}
                />
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => void onLogoFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className={SECONDARY}
                  disabled={logoBusy}
                  onClick={() => logoRef.current?.click()}
                >
                  {logoBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Uploading...
                    </>
                  ) : (
                    "Upload logo"
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="co-tz">
                Timezone <span className="font-normal normal-case text-pulse-muted">(optional)</span>
              </label>
              <input
                id="co-tz"
                className={FIELD}
                value={coTz}
                onChange={(e) => setCoTz(e.target.value)}
                placeholder="e.g. America/Toronto"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="co-ind">
                Industry <span className="font-normal normal-case text-pulse-muted">(optional)</span>
              </label>
              <input
                id="co-ind"
                className={FIELD}
                value={coIndustry}
                onChange={(e) => setCoIndustry(e.target.value)}
                placeholder="e.g. Manufacturing"
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className={CARD}>
        <h2 className="text-sm font-bold tracking-tight text-pulse-navy dark:text-slate-100">Workforce role</h2>
        <p className="mt-1 text-sm text-pulse-muted">
          Operations, scheduling, and monitoring only include people who participate here. This is separate from
          administrator permissions.
        </p>
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-ds-border bg-ds-secondary px-3 py-3">
            <div>
              <p className="text-sm font-semibold text-ds-foreground">Participate in operations</p>
              <p className="mt-0.5 text-xs text-ds-muted">
                Turn off to exclude yourself from workforce monitoring and operational rosters.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={participate}
              onClick={() => setParticipate((p) => !p)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                participate ? "bg-[#2B4C7E]" : "bg-slate-200 dark:bg-ds-elevated"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  participate ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {participate ? (
            <div>
              <label className={LABEL} htmlFor="op-role">
                Operational role
              </label>
              <select
                id="op-role"
                className={FIELD}
                value={opRole}
                onChange={(e) => setOpRole(e.target.value)}
              >
                <option value="worker">Worker</option>
                <option value="manager">Manager</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>
          ) : null}
        </div>
      </section>

      <div className="flex justify-end">
        <button type="button" className={PRIMARY} disabled={saving} onClick={() => void onSave()}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </button>
      </div>
    </div>
  );
}
