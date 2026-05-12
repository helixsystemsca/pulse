"use client";

/**
 * frontend/components/settings/SettingsApp.tsx
 * ════════════════════════════════════════════════════════════════════════════
 * Full settings page with 8 module tabs + zone override panel.
 * Reads from /api/v1/config/all on mount.
 * Each section saves independently — no giant "Save all" button.
 * Deep-linkable via ?tab=schedule (or any module name).
 */

import {
  Activity,
  Bell,
  Building2,
  Globe,
  Layers,
  LayoutGrid,
  Settings,
  Shield,
  Sparkles,
  Star,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAllConfig } from "@/lib/config/useConfig";
import type { ConfigModule, ModuleConfig } from "@/lib/config/service";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { canAccessCompanyConfiguration } from "@/lib/pulse-roles";
import { PageHeader } from "@/components/ui/PageHeader";

// ── Tab definitions ───────────────────────────────────────────────────────────

type Tab = {
  id:       ConfigModule | "zones";
  label:    string;
  icon:     ReactNode;
  adminOnly?: boolean;
};

const TABS: Tab[] = [
  { id: "global",        label: "General",        icon: <Globe      className="h-4 w-4" /> },
  { id: "workRequests",  label: "Work Requests",   icon: <Wrench     className="h-4 w-4" /> },
  { id: "schedule",      label: "Schedule",        icon: <LayoutGrid className="h-4 w-4" /> },
  { id: "workers",       label: "Workers",         icon: <Users      className="h-4 w-4" /> },
  { id: "zones",         label: "Zones",           icon: <Layers     className="h-4 w-4" /> },
  { id: "automation",    label: "Automation",      icon: <Zap        className="h-4 w-4" /> },
  { id: "compliance",    label: "Compliance",      icon: <Shield     className="h-4 w-4" /> },
  { id: "notifications", label: "Notifications",   icon: <Bell       className="h-4 w-4" /> },
  { id: "gamification",  label: "Gamification",    icon: <Star       className="h-4 w-4" /> },
];

// ── Field renderers ───────────────────────────────────────────────────────────

function Toggle({
  label, description, value, onChange, disabled,
}: {
  label: string; description?: string;
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-ds-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ds-foreground">{label}</p>
        {description && <p className="text-xs text-ds-muted mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative shrink-0 h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent ${
          value ? "bg-ds-accent" : "bg-ds-border"
        } disabled:opacity-50`}
        role="switch"
        aria-checked={value}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-ds-primary shadow transition-transform ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function NumberField({
  label, description, value, onChange, min, max, suffix, disabled,
}: {
  label: string; description?: string;
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; suffix?: string; disabled?: boolean;
}) {
  return (
    <div className="py-3 border-b border-ds-border last:border-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ds-foreground">{label}</p>
          {description && <p className="text-xs text-ds-muted mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="number"
            disabled={disabled}
            value={value}
            min={min}
            max={max}
            onChange={e => onChange(Number(e.target.value))}
            className="w-20 rounded-md border border-ds-border bg-ds-primary px-2 py-1 text-sm text-ds-foreground text-right focus:outline-none focus:ring-2 focus:ring-ds-accent disabled:opacity-50"
          />
          {suffix && <span className="text-xs text-ds-muted">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

function TextField({
  label, description, value, onChange, placeholder, disabled,
}: {
  label: string; description?: string;
  value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean;
}) {
  return (
    <div className="py-3 border-b border-ds-border last:border-0">
      <p className="text-sm font-medium text-ds-foreground mb-1">{label}</p>
      {description && <p className="text-xs text-ds-muted mb-2">{description}</p>}
      <input
        type="text"
        disabled={disabled}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-ds-border bg-ds-primary px-3 py-1.5 text-sm text-ds-foreground placeholder:text-ds-muted/50 focus:outline-none focus:ring-2 focus:ring-ds-accent disabled:opacity-50"
      />
    </div>
  );
}

function ListField({
  label, description, value, onChange, placeholder, disabled,
}: {
  label: string; description?: string;
  value: string[]; onChange: (v: string[]) => void;
  placeholder?: string; disabled?: boolean;
}) {
  const text = value.join("\n");
  return (
    <div className="py-3 border-b border-ds-border last:border-0">
      <p className="text-sm font-medium text-ds-foreground mb-1">{label}</p>
      {description && <p className="text-xs text-ds-muted mb-2">{description}</p>}
      <textarea
        disabled={disabled}
        value={text}
        onChange={e => onChange(e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
        placeholder={placeholder ?? "One item per line"}
        rows={4}
        className="w-full rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground placeholder:text-ds-muted/50 focus:outline-none focus:ring-2 focus:ring-ds-accent disabled:opacity-50 font-mono resize-y"
      />
      <p className="text-[10px] text-ds-muted mt-1">{value.length} items · one per line</p>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  title, description, children, onSave, saving, saved, canEdit,
}: {
  title: string; description?: string; children: ReactNode;
  onSave: () => void; saving: boolean; saved: boolean; canEdit: boolean;
}) {
  return (
    <div className="rounded-lg border border-ds-border bg-ds-primary overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-ds-border flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ds-foreground">{title}</h3>
          {description && <p className="text-xs text-ds-muted mt-0.5 leading-relaxed">{description}</p>}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="shrink-0 rounded-md bg-ds-accent px-3 py-1.5 text-xs font-semibold text-ds-accent-foreground hover:bg-ds-accent/90 disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save"}
          </button>
        )}
      </div>
      <div className="px-5 py-1">
        {children}
      </div>
    </div>
  );
}

// ── Tab panels ────────────────────────────────────────────────────────────────

function useSection(
  initial: ModuleConfig | undefined,
  patch: (mod: ConfigModule, vals: ModuleConfig) => Promise<boolean>,
  module: ConfigModule,
) {
  const [draft,  setDraft]  = useState<ModuleConfig>(initial ?? {});
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => { if (initial) setDraft(initial); }, [initial]);

  const set = useCallback((key: string, value: unknown) => {
    setDraft(d => ({ ...d, [key]: value }));
    setSaved(false);
  }, []);

  const save = useCallback(async (keys?: string[]) => {
    setSaving(true);
    const values = keys
      ? Object.fromEntries(keys.map(k => [k, draft[k]]))
      : draft;
    const ok = await patch(module, values);
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }, [draft, module, patch]);

  return { draft, set, save, saving, saved };
}

// ── GENERAL tab ───────────────────────────────────────────────────────────────

function GeneralTab({ config, patch, canEdit }: {
  config: ModuleConfig | undefined;
  patch: (mod: ConfigModule, vals: ModuleConfig) => Promise<boolean>;
  canEdit: boolean;
}) {
  const s = useSection(config, patch, "global");
  const d = s.draft;
  return (
    <>
      <Section title="Facility" description="Basic info shown across the product." onSave={() => s.save(["facility_name","industry","timezone"])} saving={s.saving} saved={s.saved} canEdit={canEdit}>
        <TextField label="Facility name" value={String(d.facility_name ?? "")} onChange={v => s.set("facility_name", v)} disabled={!canEdit} />
        <TextField label="Industry" description="Helps tailor terminology. e.g. Recreation, Healthcare, Warehousing" value={String(d.industry ?? "")} onChange={v => s.set("industry", v)} placeholder="Recreation" disabled={!canEdit} />
        <TextField label="Timezone" description="All times in the app use this timezone." value={String(d.timezone ?? "UTC")} onChange={v => s.set("timezone", v)} placeholder="America/Edmonton" disabled={!canEdit} />
      </Section>

      <Section title="Location" description="Used for the weather widget on the dashboard. Leave blank to hide the widget." onSave={() => s.save(["latitude","longitude"])} saving={s.saving} saved={s.saved} canEdit={canEdit}>
        <NumberField label="Latitude" value={Number(d.latitude ?? 0)} onChange={v => s.set("latitude", v)} disabled={!canEdit} />
        <NumberField label="Longitude" value={Number(d.longitude ?? 0)} onChange={v => s.set("longitude", v)} disabled={!canEdit} />
      </Section>

      <Section title="Display" onSave={() => s.save(["date_format","time_format","currency"])} saving={s.saving} saved={s.saved} canEdit={canEdit}>
        <TextField label="Date format" value={String(d.date_format ?? "MMM D, YYYY")} onChange={v => s.set("date_format", v)} disabled={!canEdit} />
        <Toggle label="24-hour time" value={d.time_format === "24h"} onChange={v => s.set("time_format", v ? "24h" : "12h")} disabled={!canEdit} />
        <TextField label="Currency code" value={String(d.currency ?? "CAD")} onChange={v => s.set("currency", v)} placeholder="CAD" disabled={!canEdit} />
      </Section>
    </>
  );
}

// ── WORK REQUESTS tab ─────────────────────────────────────────────────────────

function WorkRequestsTab({ config, patch, canEdit }: {
  config: ModuleConfig | undefined;
  patch: (mod: ConfigModule, vals: ModuleConfig) => Promise<boolean>;
  canEdit: boolean;
}) {
  const s = useSection(config, patch, "workRequests");
  const d = s.draft;
  return (
    <>
      <Section title="Behaviour" onSave={() => s.save(["requirePhotoOnClose","lockAfterCompletion","allowManualOverride","autoAssignTechnician","enablePriorityLevels"])} saving={s.saving} saved={s.saved} canEdit={canEdit}>
        <Toggle label="Enable priority levels" description="Show Low / Medium / High / Critical on work orders." value={Boolean(d.enablePriorityLevels)} onChange={v => s.set("enablePriorityLevels", v)} disabled={!canEdit} />
        <Toggle label="Auto-assign to creator" description="New requests assign to the creating user if no assignee is chosen." value={Boolean(d.autoAssignTechnician)} onChange={v => s.set("autoAssignTechnician", v)} disabled={!canEdit} />
        <Toggle label="Require photo to close" description="Technicians must attach a file before marking completed." value={Boolean(d.requirePhotoOnClose)} onChange={v => s.set("requirePhotoOnClose", v)} disabled={!canEdit} />
        <Toggle label="Lock after completion" description="Prevent re-opening completed work orders." value={Boolean(d.lockAfterCompletion)} onChange={v => s.set("lockAfterCompletion", v)} disabled={!canEdit} />
        <Toggle label="Managers may reopen" description="When locking is on, managers can still move status off completed." value={Boolean(d.allowManualOverride)} onChange={v => s.set("allowManualOverride", v)} disabled={!canEdit} />
      </Section>

      <Section title="Categories" description="Custom category labels available when creating a work request." onSave={() => s.save(["categories"])} saving={s.saving} saved={s.saved} canEdit={canEdit}>
        <ListField label="Categories" value={Array.isArray(d.categories) ? d.categories as string[] : []} onChange={v => s.set("categories", v)} placeholder={"Electrical\nPlumbing\nHVAC\nJanitorial\nGeneral"} disabled={!canEdit} />
      </Section>

      <Section title="SLA" description="Response time targets by priority. Set to 0 to disable." onSave={() => s.save(["sla.enabled","sla.p1_response_minutes","sla.p2_response_minutes","sla.p3_response_minutes"])} saving={s.saving} saved={s.saved} canEdit={canEdit}>
        <Toggle label="Enable SLA tracking" value={Boolean(d["sla.enabled"])} onChange={v => s.set("sla.enabled", v)} disabled={!canEdit} />
        <NumberField label="P1 Critical — response target" value={Number(d["sla.p1_response_minutes"] ?? 60)} onChange={v => s.set("sla.p1_response_minutes", v)} suffix="min" disabled={!canEdit} />
        <NumberField label="P2 High — response target" value={Number(d["sla.p2_response_minutes"] ?? 240)} onChange={v => s.set("sla.p2_response_minutes", v)} suffix="min" disabled={!canEdit} />
        <NumberField label="P3 Standard — response target" value={Number(d["sla.p3_response_minutes"] ?? 1440)} onChange={v => s.set("sla.p3_response_minutes", v)} suffix="min" disabled={!canEdit} />
      </Section>
    </>
  );
}

// ── WORKERS tab ───────────────────────────────────────────────────────────────

function WorkersTab({ config, patch, canEdit }: {
  config: ModuleConfig | undefined;
  patch: (mod: ConfigModule, vals: ModuleConfig) => Promise<boolean>;
  canEdit: boolean;
}) {
  const s = useSection(config, patch, "workers");
  const d = s.draft;

  const certDefs = (d.certifications as { definitions?: Array<{ code: string; label: string }> })?.definitions ?? [];
  const certText = certDefs.map(c => `${c.code}: ${c.label}`).join("\n");

  return (
    <>
      <Section title="Operational Roles" description="Custom role names for your facility. These appear in scheduling, work orders, and inference matching." onSave={() => s.save(["operational_roles"])} saving={s.saving} saved={s.saved} canEdit={canEdit}>
        <ListField label="Roles" value={Array.isArray(d.operational_roles) ? d.operational_roles as string[] : []} onChange={v => s.set("operational_roles", v)} placeholder={"Pool Technician\nIce Technician\nHVAC Technician\nGeneral Maintenance\nFacility Manager"} disabled={!canEdit} />
      </Section>

      <Section title="Certifications" description={`Define certification codes shown on shift chips. Format: CODE: Label (one per line)\ne.g. RO: Refrigeration Operator`} onSave={() => {
        const defs = certText.split("\n")
          .map(line => { const [code, ...rest] = line.split(":"); return { code: code.trim().toUpperCase(), label: rest.join(":").trim() }; })
          .filter(d => d.code && d.label);
        s.set("certifications", { definitions: defs, priority_order: defs.map(d => d.code) });
        void s.save(["certifications"]);
      }} saving={s.saving} saved={s.saved} canEdit={canEdit}>
        <ListField
          label="Certification codes"
          value={certDefs.map(c => `${c.code}: ${c.label}`)}
          onChange={lines => {
            const defs = lines.map(line => { const [code, ...rest] = line.split(":"); return { code: code.trim().toUpperCase(), label: rest.join(":").trim() }; }).filter(d => d.code);
            s.set("certifications", { definitions: defs, priority_order: defs.map(d => d.code) });
          }}
          placeholder={"RO: Refrigeration Operator\nP4: 4th Class Power Engineer\nP1: Pool Operator Level 1\nP2: Pool Operator Level 2\nFA: First Aid"}
          disabled={!canEdit}
        />
      </Section>

      <Section title="Features" onSave={() => s.save(["skill_tags_enabled","cert_tracking_enabled","gamification_enabled"])} saving={s.saving} saved={s.saved} canEdit={canEdit}>
        <Toggle label="Skill tags" description="Allow tagging workers with skill categories." value={Boolean(d.skill_tags_enabled)} onChange={v => s.set("skill_tags_enabled", v)} disabled={!canEdit} />
        <Toggle label="Certification tracking" description="Track cert expiry and enforce cert requirements on shifts." value={Boolean(d.cert_tracking_enabled)} onChange={v => s.set("cert_tracking_enabled", v)} disabled={!canEdit} />
        <Toggle label="Gamification" description="Show XP, badges, and leaderboard for workers." value={Boolean(d.gamification_enabled)} onChange={v => s.set("gamification_enabled", v)} disabled={!canEdit} />
      </Section>
    </>
  );
}

// ── AUTOMATION tab ────────────────────────────────────────────────────────────

function AutomationTab({ config, patch, canEdit }: {
  config: ModuleConfig | undefined;
  patch: (mod: ConfigModule, vals: ModuleConfig) => Promise<boolean>;
  canEdit: boolean;
}) {
  const s = useSection(config, patch, "automation");
  const d = s.draft;
  return (
    <>
      <Section title="Proximity Tracking" description="Controls how BLE beacon proximity events are detected and fired." onSave={() => s.save(["proximity_tracking_enabled","min_duration_seconds","cooldown_seconds","min_consecutive_near","max_session_seconds"])} saving={s.saving} saved={s.saved} canEdit={canEdit}>
        <Toggle label="Enable proximity tracking" value={Boolean(d.proximity_tracking_enabled)} onChange={v => s.set("proximity_tracking_enabled", v)} disabled={!canEdit} />
        <NumberField label="Minimum dwell time" description="How long a worker must be near equipment before an event fires." value={Number(d.min_duration_seconds ?? 10)} onChange={v => s.set("min_duration_seconds", v)} suffix="sec" disabled={!canEdit} />
        <NumberField label="Cooldown between events" description="Minimum gap before the same pair can fire again." value={Number(d.cooldown_seconds ?? 60)} onChange={v => s.set("cooldown_seconds", v)} suffix="sec" disabled={!canEdit} />
        <NumberField label="Minimum consecutive near readings" value={Number(d.min_consecutive_near ?? 2)} onChange={v => s.set("min_consecutive_near", v)} disabled={!canEdit} />
        <NumberField label="Max session length" value={Number(d.max_session_seconds ?? 300)} onChange={v => s.set("max_session_seconds", v)} suffix="sec" disabled={!canEdit} />
      </Section>

      <Section title="Maintenance Inference" description="Confidence thresholds for the PM inference engine." onSave={() => s.save(["inference_enabled","inference_notify_threshold","inference_flag_threshold"])} saving={s.saving} saved={s.saved} canEdit={canEdit}>
        <Toggle label="Enable PM inference" description="Automatically detect when a worker is performing maintenance and prompt confirmation." value={Boolean(d.inference_enabled)} onChange={v => s.set("inference_enabled", v)} disabled={!canEdit} />
        <NumberField label="Notify worker threshold" description="Confidence % to send a push notification to the worker." value={Math.round(Number(d.inference_notify_threshold ?? 0.9) * 100)} onChange={v => s.set("inference_notify_threshold", v / 100)} suffix="%" disabled={!canEdit} />
        <NumberField label="Flag for manager threshold" description="Confidence % to flag for manager review (no worker notification)." value={Math.round(Number(d.inference_flag_threshold ?? 0.7) * 100)} onChange={v => s.set("inference_flag_threshold", v / 100)} suffix="%" disabled={!canEdit} />
      </Section>

      <Section title="Escalation" onSave={() => s.save(["escalation_delay_seconds","sop_alerts_enabled"])} saving={s.saving} saved={s.saved} canEdit={canEdit}>
        <Toggle label="SOP alerts enabled" value={Boolean(d.sop_alerts_enabled)} onChange={v => s.set("sop_alerts_enabled", v)} disabled={!canEdit} />
        <NumberField label="Escalation delay" description="How long before an unacknowledged alert escalates." value={Number(d.escalation_delay_seconds ?? 120)} onChange={v => s.set("escalation_delay_seconds", v)} suffix="sec" disabled={!canEdit} />
      </Section>
    </>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export function SettingsApp() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { session }  = usePulseAuth();

  const initialTab = (searchParams.get("tab") as ConfigModule | "zones") ?? "global";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const companyId = session?.company_id ?? null;
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const mayAccessOrgSettings = isSystemAdmin || canAccessCompanyConfiguration(session);
  const { config, loading, error, canEdit, patch } = useAllConfig(companyId);

  const switchTab = useCallback((id: string) => {
    setActiveTab(id);
    router.replace(`/settings?tab=${id}`, { scroll: false });
  }, [router]);

  const patchModule = useCallback(async (mod: ConfigModule, vals: ModuleConfig) => {
    return patch(mod, vals);
  }, [patch]);

  const activeConfig = config?.[activeTab as ConfigModule];

  if (session && !mayAccessOrgSettings) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="Configure Pulse for your facility." icon={Settings} />
        <p className="text-sm text-ds-muted">
          Organization settings are restricted to company administrators. Contact an administrator if you need changes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure Pulse for your facility." icon={Settings} />

      <nav className="flex flex-wrap gap-1 rounded-md border border-ds-border bg-ds-secondary p-1" aria-label="Settings sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchTab(tab.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-ds-success bg-ds-primary text-ds-foreground"
                : "border-b-2 border-transparent text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      <div>
          {!canEdit && (
            <div className="mb-4 rounded-md border border-ds-border bg-ds-primary px-4 py-3 text-xs text-ds-muted">
              You have read-only access to settings. Contact your administrator to make changes.
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-ds-muted py-8">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-ds-accent border-t-transparent" />
              Loading settings…
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-4">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {activeTab === "global"        && <GeneralTab      config={activeConfig} patch={patchModule} canEdit={canEdit} />}
              {activeTab === "workRequests"  && <WorkRequestsTab config={activeConfig} patch={patchModule} canEdit={canEdit} />}
              {activeTab === "workers"       && <WorkersTab      config={activeConfig} patch={patchModule} canEdit={canEdit} />}
              {activeTab === "automation"    && <AutomationTab   config={activeConfig} patch={patchModule} canEdit={canEdit} />}
              {activeTab === "schedule"      && (
                <div className="text-sm text-ds-muted py-4">
                  Schedule settings are available in the Schedule module gear icon.<br />
                  <a href="/schedule" className="text-ds-accent underline mt-1 inline-block">Go to Schedule →</a>
                </div>
              )}
              {activeTab === "zones"         && (
                <div className="text-sm text-ds-muted py-4">
                  Zone-level config overrides are set from the Zones & Devices page.<br />
                  <a href="/devices" className="text-ds-accent underline mt-1 inline-block">Go to Zones & Devices →</a>
                </div>
              )}
              {activeTab === "compliance"    && (
                <div className="text-sm text-ds-muted py-4">Compliance settings coming soon.</div>
              )}
              {activeTab === "notifications" && (
                <div className="text-sm text-ds-muted py-4">Notification settings coming soon.</div>
              )}
              {activeTab === "gamification"  && (
                <div className="text-sm text-ds-muted py-4">Gamification settings coming soon.</div>
              )}
            </>
          )}
      </div>
    </div>
  );
}
