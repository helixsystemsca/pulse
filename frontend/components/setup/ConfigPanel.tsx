"use client";

import { Loader2, SlidersHorizontal } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const panel =
  "rounded-md border border-slate-200/80 bg-white p-6 shadow-card space-y-8";
const titleLbl = "text-sm font-semibold text-pulse-navy";
const hint = "mt-1 text-xs leading-relaxed text-pulse-muted";
const field =
  "mt-1.5 w-full rounded-md border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25";
const saveBtn = cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex items-center gap-2 px-4 py-2");

function FieldBlock({
  label,
  description,
  children,
  className: classNameProp = "",
}: {
  label: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={classNameProp}>
      <span className={titleLbl}>{label}</span>
      <p className={hint}>{description}</p>
      {children}
    </div>
  );
}

export function ConfigPanel({
  proximity,
  sopAlerts,
  saving,
  onSaveProximity,
  onSaveSop,
}: {
  proximity: Record<string, unknown> | undefined;
  sopAlerts: Record<string, unknown> | undefined;
  saving: boolean;
  onSaveProximity: (body: { enabled: boolean; config: Record<string, unknown> }) => Promise<void>;
  onSaveSop: (body: { enabled: boolean; config: Record<string, unknown> }) => Promise<void>;
}) {
  const [proxEnabled, setProxEnabled] = useState(true);
  const [minDur, setMinDur] = useState("10");
  const [cooldown, setCooldown] = useState("60");
  const [movement, setMovement] = useState(true);

  const [sopEnabled, setSopEnabled] = useState(true);
  const [escalation, setEscalation] = useState("120");

  useEffect(() => {
    const p = proximity;
    setProxEnabled(Boolean(p?.enabled ?? true));
    setMinDur(String(p?.min_duration_seconds ?? 10));
    setCooldown(String(p?.cooldown_seconds ?? 60));
    setMovement(Boolean(p?.movement_required ?? true));
  }, [proximity]);

  useEffect(() => {
    const s = sopAlerts;
    setSopEnabled(Boolean(s?.enabled ?? true));
    setEscalation(String(s?.escalation_delay_seconds ?? 120));
  }, [sopAlerts]);

  return (
    <div className={panel}>
      <div className="flex items-center gap-2 text-pulse-navy">
        <SlidersHorizontal className="h-5 w-5 text-[#2B4C7E]" aria-hidden />
        <h2 className="text-lg font-semibold">Automation settings</h2>
      </div>
      <p className="text-sm text-pulse-muted">
        Tune how the system reacts to presence and procedures. These are product parameters — not a custom rule builder.
      </p>

      <section className="rounded-md bg-slate-50/80 p-5 ring-1 ring-slate-200/60">
        <h3 className="text-base font-semibold text-pulse-navy">Proximity tracking</h3>
        <p className="mt-1 text-sm text-pulse-muted">
          Controls how long someone must be near equipment before the session counts, and how often signals can repeat.
        </p>
        <div className="mt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-pulse-navy">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={proxEnabled}
              onChange={(e) => setProxEnabled(e.target.checked)}
            />
            Enable proximity tracking
          </label>
          <p className={hint}>Turns the feature on for this company. Off means proximity logic will not run.</p>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <FieldBlock
            label='Trigger after (seconds)'
            description="Minimum time a worker must be classified as near equipment before actions can fire — reduces false starts from brief walk-bys."
          >
            <input
              type="number"
              min={1}
              className={field}
              value={minDur}
              onChange={(e) => setMinDur(e.target.value)}
            />
          </FieldBlock>
          <FieldBlock
            label="Require movement"
            description="When on, telemetry must show movement before a proximity session can advance — helps filter noisy static reads."
          >
            <label className="mt-1.5 flex cursor-pointer items-center gap-2 rounded-md border border-slate-200/90 bg-white px-3 py-3 text-sm text-pulse-navy shadow-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={movement}
                onChange={(e) => setMovement(e.target.checked)}
              />
              Movement signal required
            </label>
          </FieldBlock>
          <FieldBlock
            label="Cooldown (seconds)"
            description="Quiet period after a proximity event before another similar event can run — prevents alert storms on chatter."
            className="sm:col-span-2"
          >
            <input
              type="number"
              min={0}
              className={`${field} max-w-xs`}
              value={cooldown}
              onChange={(e) => setCooldown(e.target.value)}
            />
          </FieldBlock>
        </div>
        <button
          type="button"
          disabled={saving}
          className={`mt-6 ${saveBtn}`}
          onClick={() =>
            onSaveProximity({
              enabled: proxEnabled,
              config: {
                min_duration_seconds: Number(minDur) || 0,
                cooldown_seconds: Number(cooldown) || 0,
                movement_required: movement,
              },
            })
          }
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save proximity settings
        </button>
      </section>

      <section className="rounded-md bg-slate-50/80 p-5 ring-1 ring-slate-200/60">
        <h3 className="text-base font-semibold text-pulse-navy">SOP alerts</h3>
        <p className="mt-1 text-sm text-pulse-muted">
          Timing for standard operating procedure reminders and escalations.
        </p>
        <div className="mt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-pulse-navy">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={sopEnabled}
              onChange={(e) => setSopEnabled(e.target.checked)}
            />
            Enable SOP alerts
          </label>
          <p className={hint}>Allows the system to surface procedure gaps or overdue steps for this tenant.</p>
        </div>
        <FieldBlock
          label="Escalation delay (seconds)"
          description="How long to wait before bumping visibility (e.g. supervisor or second channel) when an SOP item stays open."
          className="mt-6 max-w-md"
        >
          <input
            type="number"
            min={0}
            className={field}
            value={escalation}
            onChange={(e) => setEscalation(e.target.value)}
          />
        </FieldBlock>
        <button
          type="button"
          disabled={saving}
          className={`mt-6 ${saveBtn}`}
          onClick={() =>
            onSaveSop({
              enabled: sopEnabled,
              config: {
                escalation_delay_seconds: Number(escalation) || 0,
              },
            })
          }
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save SOP settings
        </button>
      </section>
    </div>
  );
}
