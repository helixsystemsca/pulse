"use client";

import {
  AlarmClock,
  Award,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  Flame,
  Gauge,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AchievementGrid } from "@/components/operations/xp/AchievementGrid";
import { ProfileCustomizationModal } from "@/components/operations/xp/ProfileCustomizationModal";
import { RadialXpRing } from "@/components/operations/xp/RadialXpRing";
import { WorkerXpCard } from "@/components/operations/xp/WorkerXpCard";
import { XpTimeline } from "@/components/operations/xp/XpTimeline";
import { WowXpBar } from "@/components/gamification/WowXpBar";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/pulse/Card";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { apiFetch, refreshPulseUserFromServer } from "@/lib/api";
import { getGamificationMe, patchAvatarBorder, type GamificationMe } from "@/lib/gamificationService";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { listProcedureAcknowledgments } from "@/lib/procedureAcknowledgments";
import type { PulseShiftApi, PulseZoneApi } from "@/lib/schedule/pulse-bridge";
import { sessionHasAnyRole, workerRoleDisplayLabel } from "@/lib/pulse-roles";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { fetchWorkerTraining, mapApiAssignments, mapApiPrograms } from "@/lib/trainingApi";
import type { TrainingAssignment, TrainingProgram } from "@/lib/training/types";
import { fetchWorkerDetail, type WorkerDetail } from "@/lib/workersService";
import {
  pickFeaturedBadges,
  portraitFrameForBorderId,
  readEquippedTitleSlug,
  readFeaturedBadgeIds,
  resolveEquippedTitleLabel,
} from "@/lib/profileCosmetics";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { EditProfileDrawer } from "./EditProfileDrawer";
import { InsightMetricGrid, PersonalInsightCard } from "./PersonalInsightCard";
import type { ProfileIdentityBadge } from "./ProfileHeaderCard";
import { ProfileHeaderCard } from "./ProfileHeaderCard";
import { ProfileAccountSection } from "./ProfileAccountSection";
import { ProfileRecommendationsSection, type RecommendationItem } from "./ProfileRecommendationsSection";
import type { UpcomingShiftRow } from "./UpcomingShiftCard";
import { UpcomingShiftCard } from "./UpcomingShiftCard";

const OP_ROLES = ["worker", "manager", "supervisor"] as const;

function deriveIdentityBadges(session: PulseAuthSession, worker: WorkerDetail | null): ProfileIdentityBadge[] {
  const roles = session.roles?.length ? session.roles : session.role ? [session.role] : [];
  const set = new Set(roles.map((r) => r.toLowerCase()));
  const out: ProfileIdentityBadge[] = [];
  if (set.has("lead")) out.push({ key: "lead", label: "Lead", tone: "teal" });
  if (set.has("supervisor")) out.push({ key: "supervisor", label: "Supervisor", tone: "cobalt" });
  if (set.has("manager")) out.push({ key: "manager", label: "Manager", tone: "amber" });
  if (set.has("company_admin")) out.push({ key: "admin", label: "Company admin", tone: "slate" });
  if (worker?.certifications?.length)
    out.push({ key: "cert", label: "Certified", tone: "coral" });
  if (worker?.skills?.some((s) => /train/i.test(s.name))) out.push({ key: "trainer", label: "Trainer", tone: "cobalt" });
  if (worker?.skills?.some((s) => /safety/i.test(s.name))) out.push({ key: "safety", label: "Safety rep", tone: "amber" });
  return out;
}

function accountStatusLabel(w: WorkerDetail | null): string {
  if (!w) return "Active";
  const raw = (w.account_status || "").replace(/_/g, " ").trim();
  if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1);
  return w.is_active ? "Active" : "Inactive";
}

/** Facility / permission tier label — matches Team Management roster wording (Coordinator vs Operations vs Staff). */
function profileFacilityRoleLine(worker: WorkerDetail | null, session: PulseAuthSession): string {
  const override = session.role_display_label?.trim();
  if (override) return override;
  const dept = worker?.department ?? session.hr_department ?? undefined;
  const roleKey = (session.role ?? "worker").trim().toLowerCase();
  return workerRoleDisplayLabel(dept, roleKey);
}

function buildShiftRows(shifts: PulseShiftApi[], zones: PulseZoneApi[], userId: string): UpcomingShiftRow[] {
  const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
  const filtered = shifts
    .filter((s) => s.assigned_user_id === userId && s.is_draft !== true)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 5);

  return filtered.map((s) => {
    const start = new Date(s.starts_at);
    const end = new Date(s.ends_at);
    const fid = s.facility_id || s.zone_id || "";
    const facilityName = (fid && zoneMap.get(fid)) || "Scheduled shift";
    return {
      id: s.id,
      dayLabel: start.toLocaleDateString(undefined, { weekday: "long" }),
      dateLabel: start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      facilityName,
      timeRange: `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`,
      shiftCode: s.shift_code ?? null,
      label: s.display_label ?? s.project_name ?? null,
    };
  });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (86400 * 1000));
}

export function ProfilePage() {
  const { session } = usePulseAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [gamification, setGamification] = useState<GamificationMe | null>(null);
  const [trainingPrograms, setTrainingPrograms] = useState<TrainingProgram[]>([]);
  const [trainingAssignments, setTrainingAssignments] = useState<TrainingAssignment[]>([]);
  const [shifts, setShifts] = useState<PulseShiftApi[]>([]);
  const [zones, setZones] = useState<PulseZoneApi[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [borderBusy, setBorderBusy] = useState(false);
  const [cosmeticTick, setCosmeticTick] = useState(0);
  const [customOpen, setCustomOpen] = useState(false);
  const { reduced } = useReducedEffects();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [participate, setParticipate] = useState(false);
  const [opRole, setOpRole] = useState<string>("worker");
  const [coName, setCoName] = useState("");
  const [coTz, setCoTz] = useState("");
  const [coIndustry, setCoIndustry] = useState("");

  const [procedureAcks, setProcedureAcks] = useState<{ procedure_id: string; procedure_title: string; signed_at: string }[]>(
    [],
  );

  const companyId = session?.company_id ?? session?.company?.id ?? null;
  const isCompanyAdmin = session ? sessionHasAnyRole(session, "company_admin") : false;

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

  const reloadSnapshot = useCallback(async () => {
    if (!session?.sub) return;
    setLoadingProfile(true);
    setErr(null);
    try {
      const cid = session.company_id ?? session.company?.id ?? null;
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 14);
      const fromIso = start.toISOString();
      const toIso = end.toISOString();

      const [g, trainRes, shiftRes, zoneRes] = await Promise.all([
        getGamificationMe().catch(() => null),
        fetchWorkerTraining(session.sub).catch(() => null),
        apiFetch<PulseShiftApi[]>(
          `/api/v1/pulse/schedule/shifts?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
        ).catch(() => []),
        apiFetch<PulseZoneApi[]>("/api/v1/pulse/zones").catch(() => []),
      ]);

      setGamification(g);
      if (trainRes) {
        setTrainingPrograms(mapApiPrograms(trainRes.programs));
        setTrainingAssignments(mapApiAssignments(trainRes.assignments));
      } else {
        setTrainingPrograms([]);
        setTrainingAssignments([]);
      }
      setShifts(Array.isArray(shiftRes) ? shiftRes : []);
      setZones(Array.isArray(zoneRes) ? zoneRes : []);

      if (cid) {
        try {
          setWorker(await fetchWorkerDetail(cid, session.sub));
        } catch {
          setWorker(null);
        }
      } else {
        setWorker(null);
      }
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setLoadingProfile(false);
    }
  }, [session]);

  useEffect(() => {
    void reloadSnapshot();
  }, [reloadSnapshot]);

  async function onBorder(id: string | null) {
    if (!gamification) return;
    setBorderBusy(true);
    setErr(null);
    try {
      await patchAvatarBorder(id);
      const next = await getGamificationMe();
      setGamification(next);
      setToast("Avatar border updated.");
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setBorderBusy(false);
    }
  }

  const badges = useMemo(() => (session ? deriveIdentityBadges(session, worker) : []), [session, worker]);

  const shiftRows = useMemo(
    () => (session?.sub ? buildShiftRows(shifts, zones, session.sub) : []),
    [shifts, zones, session?.sub],
  );

  const analytics = gamification?.analytics;

  const incompleteTraining = useMemo(
    () => trainingAssignments.filter((a) => a.status !== "completed" && a.status !== "expired"),
    [trainingAssignments],
  );

  const upcomingTrainingRows = useMemo(() => {
    const titleOf = (programId: string) =>
      trainingPrograms.find((p) => p.id === programId)?.title ?? "Training assignment";
    return incompleteTraining
      .map((a) => ({
        a,
        due: a.due_date,
        days: daysUntil(a.due_date ?? null),
        title: titleOf(a.training_program_id),
      }))
      .filter((r) => r.days !== null && r.days <= 21)
      .sort((x, y) => (x.days ?? 999) - (y.days ?? 999))
      .slice(0, 4);
  }, [incompleteTraining, trainingPrograms]);

  const expiringCerts = useMemo(() => {
    const certs = worker?.certifications ?? [];
    return certs.filter((c) => {
      const d = daysUntil(c.expiry_date);
      return d !== null && d >= 0 && d <= 90;
    });
  }, [worker?.certifications]);

  const recommendations = useMemo((): RecommendationItem[] => {
    const items: RecommendationItem[] = [];
    for (const row of upcomingTrainingRows) {
      items.push({
        id: `train-${row.a.id}`,
        title: row.title,
        detail:
          row.days === 0
            ? "Due today — finish verification while context is fresh."
            : row.days === 1
              ? "Due tomorrow — stay ahead of compliance."
              : `Due in ${row.days} days`,
        href: "/dashboard/compliance",
        actionLabel: "Open training",
        accent: "teal",
      });
    }
    for (const c of expiringCerts.slice(0, 3)) {
      const d = daysUntil(c.expiry_date);
      items.push({
        id: `cert-${c.id}`,
        title: `${c.name} renewal`,
        detail:
          d === 0
            ? "Expires today — coordinate a refresher with your supervisor."
            : `Expires in ${d} days`,
        href: "/dashboard/workers",
        actionLabel: "View certifications",
        accent: "amber",
      });
    }
    if (procedureAcks.length === 0) {
      items.push({
        id: "procedures",
        title: "Procedure library",
        detail: "Acknowledge key procedures so your whole team stays aligned on safe operations.",
        href: "/standards",
        actionLabel: "Browse standards",
        accent: "coral",
      });
    }
    return items.slice(0, 6);
  }, [upcomingTrainingRows, expiringCerts, procedureAcks.length]);

  const unlockedBorderSet = useMemo(
    () => new Set(gamification?.analytics.unlockedAvatarBorders ?? []),
    [gamification?.analytics.unlockedAvatarBorders],
  );

  const portraitStyles = useMemo(
    () => portraitFrameForBorderId(analytics?.avatarBorder, { allowAnimation: !reduced }),
    [analytics?.avatarBorder, reduced],
  );

  const equippedTitleDisplay = useMemo(
    () => resolveEquippedTitleLabel(readEquippedTitleSlug(), analytics?.professionalTitle ?? undefined),
    [cosmeticTick, analytics?.professionalTitle],
  );

  const featuredBadgesForHeader = useMemo(() => {
    const ids = readFeaturedBadgeIds();
    return pickFeaturedBadges(gamification?.badgeCatalog ?? [], ids).map((b) => ({ id: b.id, name: b.name }));
  }, [cosmeticTick, gamification?.badgeCatalog]);

  if (!session) {
    return <p className="text-sm text-pulse-muted">Sign in to view your profile.</p>;
  }

  const compliancePct = worker?.compliance_summary?.compliance_rate_pct ?? null;
  const openWr = worker?.work_summary?.open_work_requests ?? null;
  const completedTasks = worker?.work_summary?.completed_tasks ?? null;

  const hrJobTitle = (worker?.job_title ?? session.job_title ?? "").trim();
  const equippedGamificationTitle = hrJobTitle ? null : equippedTitleDisplay;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your workforce identity, momentum, and operational context — all in one place."
        icon={UserRound}
      />

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[95] max-w-md -translate-x-1/2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-lg dark:border-emerald-500/35 dark:bg-emerald-950/90 dark:text-emerald-100"
        >
          {toast}
        </div>
      ) : null}

      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
          {err}
        </div>
      ) : null}

      <PageBody>
        <ProfileHeaderCard
          displayName={fullName || email}
          email={email}
          phone={worker?.phone ?? null}
          jobTitle={hrJobTitle || undefined}
          roleLabel={profileFacilityRoleLine(worker, session)}
          department={worker?.department ?? null}
          facilityLabel={session.company?.name ?? null}
          accountStatus={accountStatusLabel(worker)}
          badges={badges}
          avatarUrl={avatarUrl}
          userId={session.sub}
          microsoftAuth={session.auth_provider === "microsoft"}
          portraitRingClassName={portraitStyles.frameClass}
          portraitAnimatedClassName={portraitStyles.animatedClass}
          equippedTitle={equippedGamificationTitle}
          featuredBadges={featuredBadgesForHeader}
          onAppearanceClick={() => setCustomOpen(true)}
          onAvatarUploaded={(next) => {
            setAvatarUrl(next);
            void reloadSnapshot();
            setToast("Profile photo updated.");
          }}
          onEditClick={() => setEditOpen(true)}
        />

        {/* Personal insights */}
        <section className="space-y-4">
          <div>
            <h2 className="font-headline text-lg font-extrabold text-ds-foreground">Personal insights</h2>
            <p className="mt-1 text-sm text-ds-muted">Performance, reliability, and recognition — aligned with Team Insights styling.</p>
          </div>

          <InsightMetricGrid>
            <PersonalInsightCard
              label="Training compliance"
              value={compliancePct !== null ? `${Math.round(compliancePct)}%` : "—"}
              hint={worker?.compliance_summary?.repeat_offender ? "Follow-up suggested" : "Based on acknowledgements"}
              icon={ClipboardCheck}
              accent="teal"
            />
            <PersonalInsightCard
              label="Procedure reads"
              value={procedureAcks.length}
              hint="Signed procedures"
              icon={Target}
              accent="cobalt"
            />
            <PersonalInsightCard
              label="On-time reliability"
              value={analytics ? `${Math.round(analytics.onTimeRate)}%` : "—"}
              hint="From completed tasks"
              icon={AlarmClock}
              accent="amber"
            />
            <PersonalInsightCard
              label="Peer review score"
              value={analytics ? `${Math.round(analytics.reviewScore)}` : "—"}
              hint="Quality signal"
              icon={Award}
              accent="coral"
            />
            <PersonalInsightCard
              label="Active streak"
              value={analytics?.streak ?? 0}
              hint="Consecutive days with XP"
              icon={Flame}
              accent="amber"
            />
            <PersonalInsightCard
              label="Tasks completed"
              value={analytics?.tasksCompleted ?? 0}
              hint="Gamified task board"
              icon={Sparkles}
              accent="teal"
            />
            <PersonalInsightCard
              label="Initiative score"
              value={analytics ? `${Math.round(analytics.initiativeScore)}` : "—"}
              hint="Going beyond the minimum"
              icon={TrendingUp}
              accent="cobalt"
            />
            <PersonalInsightCard
              label="Avg. completion"
              value={
                analytics && analytics.avgCompletionTime > 0 ? `${analytics.avgCompletionTime.toFixed(1)}h` : "—"
              }
              hint="Hours (rolling)"
              icon={Gauge}
              accent="slate"
            />
          </InsightMetricGrid>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              padding="lg"
              variant="elevated"
              className="transition-[box-shadow] duration-200 hover:shadow-[var(--ds-shadow-card-hover)] lg:col-span-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ds-muted">Level &amp; XP</p>
                  <p className="mt-1 font-headline text-lg font-extrabold text-ds-foreground">Experience arc</p>
                  <p className="mt-1 text-xs text-ds-muted">Same progression curve shown across Pulse gamification.</p>
                </div>
                <span className="rounded-full bg-[#36F1CD]/15 px-3 py-1 text-xs font-extrabold text-[#0E7C66]">
                  Level {analytics?.level ?? 1}
                </span>
              </div>
              <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_140px] lg:items-center">
                <div>
                  {analytics ? (
                    <WowXpBar
                      totalXp={analytics.totalXp}
                      level={analytics.level}
                      xpIntoLevel={analytics.xpIntoLevel}
                      xpToNextLevel={analytics.xpToNextLevel}
                      size="md"
                      showTotals
                      enablePremiumMotion
                    />
                  ) : (
                    <p className="text-sm text-ds-muted">{loadingProfile ? "Loading XP…" : "XP data unavailable."}</p>
                  )}
                </div>
                {analytics ? (
                  <div className="flex justify-center lg:justify-end">
                    <RadialXpRing
                      xpInto={analytics.xpIntoLevel ?? 0}
                      xpToNext={analytics.xpToNextLevel ?? 100}
                      level={analytics.level}
                      size={128}
                    />
                  </div>
                ) : null}
              </div>
              {analytics ? (
                <div className="mt-5">
                  <WorkerXpCard analytics={analytics} />
                </div>
              ) : null}
              <div className="mt-6 border-t border-ds-border pt-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ds-muted">Profile appearance</p>
                <p className="mt-1 text-xs text-ds-muted">
                  Portrait borders unlock at levels 10 / 20 / 30 / 50. Open appearance to equip borders, titles, and
                  featured badges.
                </p>
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ surface: "light", intent: "secondary" }),
                    "mt-3 rounded-xl px-4 py-2 text-xs font-bold",
                  )}
                  onClick={() => setCustomOpen(true)}
                >
                  Customize appearance
                </button>
              </div>
            </Card>

            <AchievementGrid catalog={gamification?.badgeCatalog ?? []} loading={loadingProfile && !gamification} />
          </div>
        </section>

        {/* Work & schedule */}
        <section className="space-y-4">
          <div>
            <h2 className="font-headline text-lg font-extrabold text-ds-foreground">Work &amp; schedule</h2>
            <p className="mt-1 text-sm text-ds-muted">Operational context pulled from roster, schedule, and work activity.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <UpcomingShiftCard shifts={shiftRows} loading={loadingProfile} />
            </div>

            <Card padding="lg" variant="primary" className="h-full transition-[box-shadow] duration-200 hover:shadow-[var(--ds-shadow-card-hover)]">
              <div className="flex items-center gap-2 text-ds-foreground">
                <Briefcase className="h-5 w-5 text-[#2B4C7E]" aria-hidden />
                <p className="font-headline text-base font-extrabold">Work activity</p>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-ds-secondary/40 px-3 py-2">
                  <dt className="font-semibold text-ds-muted">Open work requests</dt>
                  <dd className="font-extrabold tabular-nums text-ds-foreground">{openWr ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-ds-secondary/40 px-3 py-2">
                  <dt className="font-semibold text-ds-muted">Completed tasks (HR)</dt>
                  <dd className="font-extrabold tabular-nums text-ds-foreground">{completedTasks ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-ds-secondary/40 px-3 py-2">
                  <dt className="font-semibold text-ds-muted">Operational participation</dt>
                  <dd className="font-extrabold text-ds-foreground">{participate ? "Active" : "Hidden"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-ds-secondary/40 px-3 py-2">
                  <dt className="font-semibold text-ds-muted">Training queue</dt>
                  <dd className="font-extrabold tabular-nums text-ds-foreground">{incompleteTraining.length}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-col gap-2 border-t border-ds-border pt-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ds-muted">Quick actions</p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/schedule"
                    className={cn(buttonVariants({ surface: "light", intent: "accent" }), "rounded-xl px-3 py-2 text-xs font-bold")}
                  >
                    View schedule
                  </Link>
                  <Link
                    href="/schedule"
                    className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "rounded-xl px-3 py-2 text-xs font-bold")}
                  >
                    Request time off
                  </Link>
                  <Link
                    href="/dashboard/compliance"
                    className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "rounded-xl px-3 py-2 text-xs font-bold")}
                  >
                    Open training
                  </Link>
                  <Link
                    href="/dashboard/workers"
                    className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "rounded-xl px-3 py-2 text-xs font-bold")}
                  >
                    Certifications
                  </Link>
                  <Link
                    href="/dashboard/maintenance"
                    className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "rounded-xl px-3 py-2 text-xs font-bold")}
                  >
                    Work requests
                  </Link>
                </div>
              </div>
            </Card>
          </div>

          {upcomingTrainingRows.length > 0 ? (
            <Card padding="lg" variant="secondary">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[#36F1CD]" aria-hidden />
                <p className="font-headline text-base font-extrabold text-ds-foreground">Upcoming training deadlines</p>
              </div>
              <ul className="mt-4 divide-y divide-ds-border">
                {upcomingTrainingRows.map((row) => (
                  <li key={row.a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ds-foreground">{row.title}</p>
                      <p className="text-xs text-ds-muted">
                        {row.days === 0 ? "Due today" : row.days === 1 ? "Due tomorrow" : `Due in ${row.days} days`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      {row.a.status.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </section>

        {/* Recommendations & activity */}
        <section className="space-y-4">
          <ProfileRecommendationsSection items={recommendations} />
          <XpTimeline rows={gamification?.recentXp ?? []} loading={loadingProfile && !gamification} />
        </section>

        <ProfileAccountSection
          microsoftAuth={session.auth_provider === "microsoft"}
          onToast={setToast}
          onError={setErr}
        />

        {sessionHasAnyRole(session, "manager", "company_admin") ? (
          <Card padding="lg" variant="secondary" className="border-dashed border-ds-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-headline text-sm font-extrabold text-ds-foreground">
                  <Wrench className="h-4 w-4 text-ds-accent" aria-hidden />
                  Manager tools
                </p>
                <p className="mt-1 text-xs text-ds-muted">Award bonus XP when someone goes above and beyond.</p>
              </div>
              <Link
                href="/dashboard/team-insights"
                className={cn(buttonVariants({ surface: "light", intent: "accent" }), "rounded-xl px-4 py-2 text-xs font-bold")}
              >
                Open Team Insights
              </Link>
            </div>
          </Card>
        ) : null}
      </PageBody>

      <ProfileCustomizationModal
        open={customOpen}
        onClose={() => {
          setCustomOpen(false);
          setCosmeticTick((n) => n + 1);
        }}
        avatarBorder={analytics?.avatarBorder ?? null}
        unlockedBorderIds={unlockedBorderSet}
        professionalLevel={analytics?.professionalLevel ?? 1}
        badgeCatalog={gamification?.badgeCatalog ?? []}
        onSelectBorder={(id) => void onBorder(id)}
        borderBusy={borderBusy}
      />

      <EditProfileDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        userId={session.sub}
        companyId={companyId}
        email={email}
        microsoftAuth={session.auth_provider === "microsoft"}
        isCompanyAdmin={isCompanyAdmin}
        worker={worker}
        company={session.company ?? null}
        initialFullName={fullName}
        initialJobTitle={jobTitle}
        initialParticipate={participate}
        initialOpRole={opRole}
        initialCoName={coName}
        initialCoTz={coTz}
        initialCoIndustry={coIndustry}
        onProfileUpdated={() => {
          syncFromSession();
          void reloadSnapshot();
        }}
        onToast={setToast}
        onError={setErr}
      />
    </div>
  );
}
