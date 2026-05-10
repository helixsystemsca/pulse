"use client";

import { Building2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CompanyLogo } from "@/components/branding/CompanyLogo";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { useTheme } from "@/components/theme/ThemeProvider";
import { apiFetch, refreshPulseUserFromServer } from "@/lib/api";
import { uploadTenantCompanyLogoFile } from "@/lib/companyBrandingUpload";
import { getImpersonationOverlayAccessToken } from "@/lib/impersonation-overlay-token";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import type { CompanySummary } from "@/lib/pulse-session";
import type { WorkerDetail } from "@/lib/workersService";
import { patchWorker } from "@/lib/workersService";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:placeholder:text-gray-500";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

const OP_ROLES = ["worker", "manager", "supervisor"] as const;

export type EditProfileDrawerProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  companyId: string | null;
  email: string;
  microsoftAuth?: boolean;
  isCompanyAdmin: boolean;
  /** Latest worker HR row — phone, notes */
  worker: WorkerDetail | null;
  company: CompanySummary | null;
  initialFullName: string;
  initialJobTitle: string;
  initialParticipate: boolean;
  initialOpRole: string;
  initialCoName: string;
  initialCoTz: string;
  initialCoIndustry: string;
  onProfileUpdated: () => void;
  onToast: (msg: string) => void;
  onError: (msg: string | null) => void;
};

export function EditProfileDrawer({
  open,
  onClose,
  userId,
  companyId,
  email,
  microsoftAuth,
  isCompanyAdmin,
  worker,
  company,
  initialFullName,
  initialJobTitle,
  initialParticipate,
  initialOpRole,
  initialCoName,
  initialCoTz,
  initialCoIndustry,
  onProfileUpdated,
  onToast,
  onError,
}: EditProfileDrawerProps) {
  const { theme } = useTheme();
  const logoRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(initialFullName);
  const [jobTitle, setJobTitle] = useState(initialJobTitle);
  const [phone, setPhone] = useState(worker?.phone ?? "");
  const [bio, setBio] = useState(worker?.profile_notes ?? "");
  const [participate, setParticipate] = useState(initialParticipate);
  const [opRole, setOpRole] = useState(initialOpRole);

  const [coName, setCoName] = useState(initialCoName);
  const [coTz, setCoTz] = useState(initialCoTz);
  const [coIndustry, setCoIndustry] = useState(initialCoIndustry);

  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(initialFullName);
    setJobTitle(initialJobTitle);
    setPhone(worker?.phone ?? "");
    setBio(worker?.profile_notes ?? "");
    setParticipate(initialParticipate);
    setOpRole(initialOpRole);
    setCoName(initialCoName);
    setCoTz(initialCoTz);
    setCoIndustry(initialCoIndustry);
  }, [
    open,
    initialFullName,
    initialJobTitle,
    initialParticipate,
    initialOpRole,
    initialCoName,
    initialCoTz,
    initialCoIndustry,
    worker?.phone,
    worker?.profile_notes,
  ]);

  async function onLogoFile(f: File | null) {
    if (!f || !isCompanyAdmin) return;
    onError(null);
    setLogoBusy(true);
    try {
      await uploadTenantCompanyLogoFile(f);
      await refreshPulseUserFromServer();
      if (typeof window !== "undefined" && getImpersonationOverlayAccessToken()) {
        window.dispatchEvent(new Event("pulse-auth-change"));
      }
      onToast("Company logo updated.");
      if (logoRef.current) logoRef.current.value = "";
      onProfileUpdated();
    } catch (e) {
      onError(parseClientApiError(e).message);
    } finally {
      setLogoBusy(false);
    }
  }

  async function onSave() {
    onError(null);
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

      if (companyId && userId) {
        try {
          await patchWorker(companyId, userId, {
            phone: phone.trim() || null,
            profile_notes: bio.trim() || null,
          });
        } catch {
          onToast("Profile saved. Phone or notes may need a supervisor to update in Team Management.");
        }
      }

      await refreshPulseUserFromServer();
      onProfileUpdated();
      onToast("Profile saved.");
      onClose();
    } catch (e) {
      onError(parseClientApiError(e).message);
    } finally {
      setSaving(false);
    }
  }

  const SECONDARY = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5");
  const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex items-center justify-center gap-2 px-5 py-2.5");

  return (
    <PulseDrawer
      open={open}
      onClose={onClose}
      title="Edit profile"
      subtitle="Update how you show up across Pulse — saved to your live account."
      wide
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2 border-t border-ds-border bg-ds-secondary/40 px-4 py-3 dark:bg-ds-secondary/25">
          <button type="button" className={SECONDARY} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={PRIMARY} disabled={saving} onClick={() => void onSave()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-8 px-1 pb-4">
        <p className="rounded-xl border border-ds-border bg-ds-secondary/25 px-4 py-3 text-xs leading-relaxed text-ds-muted dark:bg-ds-secondary/15">
          Update your photo from the identity card — click your avatar and choose a new image (WebP, PNG, or JPG up to 5&nbsp;MB).
        </p>

        <section className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ds-muted">Personal</h3>
          <div>
            <label className={LABEL} htmlFor="drawer-profile-name">
              Name
            </label>
            <input
              id="drawer-profile-name"
              className={FIELD}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="drawer-profile-email">
              Email
            </label>
            <input
              id="drawer-profile-email"
              className={`${FIELD} bg-slate-50/80 text-pulse-muted dark:bg-[#0B1220]`}
              value={email}
              readOnly
              title="Contact your administrator to change the sign-in email."
            />
            {microsoftAuth ? (
              <p className="mt-2 text-xs text-ds-muted">Microsoft-managed accounts must update email through your IT admin.</p>
            ) : null}
          </div>
          <div>
            <label className={LABEL} htmlFor="drawer-profile-job">
              Job title <span className="font-normal normal-case text-pulse-muted">(optional)</span>
            </label>
            <input
              id="drawer-profile-job"
              className={FIELD}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Facilities Manager"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="drawer-profile-phone">
              Phone <span className="font-normal normal-case text-pulse-muted">(optional)</span>
            </label>
            <input
              id="drawer-profile-phone"
              className={FIELD}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="Reachable during shifts"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="drawer-profile-bio">
              About / notes <span className="font-normal normal-case text-pulse-muted">(optional)</span>
            </label>
            <textarea
              id="drawer-profile-bio"
              className={cn(FIELD, "min-h-[96px] resize-y")}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short intro visible to supervisors — certifications focus, preferred pronouns, etc."
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-ds-border bg-ds-secondary/20 p-4 dark:bg-ds-secondary/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ds-muted">Workforce participation</h3>
          <p className="text-xs text-ds-muted">
            Separate from admin permissions — controls operational rosters, scheduling visibility, and monitoring tiles.
          </p>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-ds-border bg-ds-primary px-3 py-3">
            <div>
              <p className="text-sm font-semibold text-ds-foreground">Participate in operations</p>
              <p className="mt-0.5 text-xs text-ds-muted">Turn off to exclude yourself from workforce surfaces.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={participate}
              onClick={() => setParticipate((p) => !p)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                participate ? "bg-ds-accent" : "bg-slate-200 dark:bg-ds-elevated"
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
              <label className={LABEL} htmlFor="drawer-op-role">
                Operational role
              </label>
              <select id="drawer-op-role" className={FIELD} value={opRole} onChange={(e) => setOpRole(e.target.value)}>
                <option value="worker">Operations</option>
                <option value="manager">Manager</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>
          ) : null}
        </section>

        {isCompanyAdmin && company ? (
          <section className="space-y-4 rounded-xl border border-ds-border bg-ds-secondary/20 p-4 dark:bg-ds-secondary/10">
            <div className="flex items-center gap-2 text-ds-foreground">
              <Building2 className="h-5 w-5 text-ds-accent" aria-hidden />
              <h3 className="text-sm font-bold">Organization</h3>
            </div>
            <p className="text-xs text-ds-muted">Company administrators only — branding and defaults for everyone.</p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="drawer-co-name">
                  Company name
                </label>
                <input id="drawer-co-name" className={FIELD} value={coName} onChange={(e) => setCoName(e.target.value)} />
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
                  <button type="button" className={SECONDARY} disabled={logoBusy} onClick={() => logoRef.current?.click()}>
                    {logoBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Uploading…
                      </>
                    ) : (
                      "Upload logo"
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="drawer-co-tz">
                  Timezone <span className="font-normal normal-case text-pulse-muted">(optional)</span>
                </label>
                <input
                  id="drawer-co-tz"
                  className={FIELD}
                  value={coTz}
                  onChange={(e) => setCoTz(e.target.value)}
                  placeholder="e.g. America/Toronto"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="drawer-co-ind">
                  Industry <span className="font-normal normal-case text-pulse-muted">(optional)</span>
                </label>
                <input
                  id="drawer-co-ind"
                  className={FIELD}
                  value={coIndustry}
                  onChange={(e) => setCoIndustry(e.target.value)}
                  placeholder="e.g. Recreation"
                />
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </PulseDrawer>
  );
}
