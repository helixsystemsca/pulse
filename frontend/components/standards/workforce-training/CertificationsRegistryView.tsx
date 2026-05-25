"use client";

import { useState } from "react";
import { Award, ChevronRight, Settings2 } from "lucide-react";
import { readSession } from "@/lib/pulse-session";
import { canManageCertificationRegistry } from "@/lib/standards/workforce-training-access";
import { useWorkforceQualifications } from "@/components/standards/workforce-training/WorkforceQualificationsContext";
import { QualificationStatusChip } from "@/components/standards/workforce-training/QualificationStatusChip";
import { dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { RegistryCoverageStats } from "@/lib/standards/employee-certifications";

export function CertificationsRegistryView() {
  const session = readSession();
  const canManage = canManageCertificationRegistry(session);
  const {
    api,
    loading,
    err,
    coverage,
    registry,
    updateRegistry,
    cycleCompetency,
    cycleVerification,
    getEffectiveCompetency,
    getEffectiveVerification,
  } = useWorkforceQualifications();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [registryOpen, setRegistryOpen] = useState(false);
  const [registryDraft, setRegistryDraft] = useState({ code: "", label: "" });

  const selected: RegistryCoverageStats | null =
    coverage.find((c) => c.code === selectedCode) ?? coverage[0] ?? null;

  const addRegistryCode = () => {
    const code = registryDraft.code.trim().toUpperCase();
    const label = registryDraft.label.trim() || code;
    if (!code) return;
    const next = [
      ...registry.filter((r) => r.code !== code),
      {
        code,
        label,
        category: "other" as const,
        defaultExpiryMonths: 24,
        requiresProof: true,
        active: true,
      },
    ];
    updateRegistry(next);
    setRegistryDraft({ code: "", label: "" });
    setSelectedCode(code);
  };

  return (
    <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
      <aside className="flex flex-col rounded-xl border border-ds-border bg-ds-card">
        <div className="border-b border-ds-border p-3">
          <h3 className="text-sm font-bold text-ds-foreground">Certification registry</h3>
          <p className="mt-1 text-xs text-ds-muted">Canonical codes — employee rows must match registry entries.</p>
          {canManage ? (
            <button
              type="button"
              onClick={() => setRegistryOpen((o) => !o)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              {registryOpen ? "Hide admin" : "Manage registry"}
            </button>
          ) : null}
        </div>
        {registryOpen && canManage ? (
          <div className="border-b border-ds-border p-3 space-y-2 bg-ds-muted/10">
            <div>
              <label className={dsLabelClass} htmlFor="reg-code">
                Code
              </label>
              <input
                id="reg-code"
                className={dsInputClass}
                value={registryDraft.code}
                onChange={(e) => setRegistryDraft((d) => ({ ...d, code: e.target.value }))}
                placeholder="RO"
              />
            </div>
            <div>
              <label className={dsLabelClass} htmlFor="reg-label">
                Label
              </label>
              <input
                id="reg-label"
                className={dsInputClass}
                value={registryDraft.label}
                onChange={(e) => setRegistryDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="Refrigeration Operator"
              />
            </div>
            <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={addRegistryCode}>
              Add code
            </Button>
          </div>
        ) : null}
        <ul className="flex-1 overflow-y-auto p-2">
          {loading ? <li className="px-2 py-4 text-sm text-ds-muted">Loading…</li> : null}
          {coverage.map((c) => {
            const active = selected?.code === c.code;
            return (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => setSelectedCode(c.code)}
                  className={cn(
                    "w-full rounded-lg px-3 py-3 text-left transition",
                    active ? "bg-ds-primary text-white" : "hover:bg-ds-muted/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold">
                      <Award className="h-4 w-4 shrink-0" aria-hidden />
                      {c.code}
                    </span>
                    <ChevronRight className={cn("h-4 w-4", active ? "text-white/70" : "text-ds-muted")} aria-hidden />
                  </div>
                  <p className={cn("mt-0.5 text-xs", active ? "text-white/80" : "text-ds-muted")}>{c.label}</p>
                  <p className={cn("mt-2 text-[11px] font-medium", active ? "text-white/90" : "text-ds-muted")}>
                    {c.qualified} qualified · {c.expiringSoon} expiring · {c.missingProof} missing proof
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="rounded-xl border border-ds-border bg-ds-card p-4">
        {err ? <p className="mb-3 text-sm text-rose-600">{err}</p> : null}
        {!selected ? (
          <p className="py-12 text-center text-sm text-ds-muted">
            {api ? "Select a certification to view holders." : "Enable API mode to load coverage."}
          </p>
        ) : (
          <>
            <header className="border-b border-ds-border pb-4">
              <h3 className="text-lg font-bold text-ds-foreground">
                {selected.code} — {selected.label}
              </h3>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {selected.qualified} qualified
                </span>
                <span className="rounded-lg bg-amber-50 px-2.5 py-1 font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  {selected.expiringSoon} expiring soon
                </span>
                <span className="rounded-lg bg-sky-50 px-2.5 py-1 font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                  {selected.missingProof} missing proof
                </span>
              </div>
            </header>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-ds-border text-left text-xs font-bold uppercase tracking-wide text-ds-muted">
                    <th className="px-3 py-2">Worker</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Expiry</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.holders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-ds-muted">
                        No qualified holders on file for this code.
                      </td>
                    </tr>
                  ) : (
                    selected.holders.map((h) => (
                      <tr key={h.id} className="border-b border-ds-border/60">
                        <td className="px-3 py-2 font-medium text-ds-foreground">{h.workerName}</td>
                        <td className="px-3 py-2 text-ds-muted">{h.department ?? "—"}</td>
                        <td className="px-3 py-2 text-ds-muted">
                          {h.expiryDate ? new Date(h.expiryDate).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <QualificationStatusChip
                            kind="competency"
                            value={getEffectiveCompetency(h)}
                            onClick={() => cycleCompetency(h)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <QualificationStatusChip
                            kind="verification"
                            value={getEffectiveVerification(h)}
                            onClick={() => cycleVerification(h)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
