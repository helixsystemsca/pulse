"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Upload } from "lucide-react";
import { isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { readSession } from "@/lib/pulse-session";
import { fetchWorkerDetail, fetchWorkerList } from "@/lib/workersService";
import {
  employeeCertificationsFromWorkerDetails,
  expiringCertifications,
  type EmployeeCertificationRecord,
} from "@/lib/standards/employee-certifications";
import {
  readCompanyCertificationRegistry,
  writeCompanyCertificationRegistry,
  type CanonicalCertificationDef,
} from "@/lib/standards/certification-registry";
import { dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { Button } from "@/components/ui/Button";

export function StandardsCertificationsApp() {
  const session = readSession();
  const api = isApiMode();
  const [registry, setRegistry] = useState<CanonicalCertificationDef[]>(() => readCompanyCertificationRegistry());
  const [rows, setRows] = useState<EmployeeCertificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [registryDraft, setRegistryDraft] = useState({ code: "", label: "" });

  const load = useCallback(async () => {
    if (!api) {
      setRows([]);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchWorkerList(session?.company_id ?? null, { include_inactive: false });
      const reg = readCompanyCertificationRegistry();
      setRegistry(reg);
      const active = (list.items ?? []).filter((w) => w.is_active);
      const details = await Promise.all(
        active.slice(0, 80).map((w) => fetchWorkerDetail(session?.company_id ?? null, w.id)),
      );
      setRows(employeeCertificationsFromWorkerDetails(details, reg));
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [api, session?.company_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const expiring = useMemo(() => expiringCertifications(rows, 60), [rows]);

  const addRegistryCode = () => {
    const code = registryDraft.code.trim().toUpperCase();
    const label = registryDraft.label.trim() || code;
    if (!code) return;
    const next = [...registry.filter((r) => r.code !== code), {
      code,
      label,
      category: "other" as const,
      defaultExpiryMonths: 24,
      requiresProof: true,
      active: true,
    }];
    setRegistry(next);
    writeCompanyCertificationRegistry(next);
    setRegistryDraft({ code: "", label: "" });
    void load();
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-ds-foreground">Certifications</h2>
        <p className="max-w-3xl text-sm text-ds-muted">
          Structured licenses and credentials from the canonical registry. Procedure sign-offs and quizzes stay under
          Procedures — not duplicated here.
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-ds-border bg-ds-card p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ds-muted">Canonical registry</h3>
        <p className="text-xs text-ds-muted">Employee rows must match a registry code — no freeform certification names.</p>
        <div className="flex flex-wrap gap-2">
          {registry.map((r) => (
            <span
              key={r.code}
              className="inline-flex items-center gap-1 rounded-full border border-ds-border bg-ds-muted/20 px-2.5 py-1 text-xs font-semibold text-ds-foreground"
            >
              <Award className="h-3 w-3" aria-hidden />
              {r.code} — {r.label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3 pt-2">
          <div>
            <label className={dsLabelClass} htmlFor="cert-code">
              Code
            </label>
            <input
              id="cert-code"
              className={dsInputClass}
              value={registryDraft.code}
              onChange={(e) => setRegistryDraft((d) => ({ ...d, code: e.target.value }))}
              placeholder="e.g. FA"
            />
          </div>
          <div>
            <label className={dsLabelClass} htmlFor="cert-label">
              Label
            </label>
            <input
              id="cert-label"
              className={dsInputClass}
              value={registryDraft.label}
              onChange={(e) => setRegistryDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="First Aid"
            />
          </div>
          <Button type="button" variant="secondary" className="h-10" onClick={addRegistryCode}>
            Add to registry
          </Button>
        </div>
      </section>

      {loading ? <p className="text-sm text-ds-muted">Loading employee certifications…</p> : null}
      {err ? <p className="text-sm font-medium text-rose-600">{err}</p> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-ds-border bg-ds-card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">On file</p>
          <p className="mt-1 text-2xl font-bold text-ds-foreground">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-ds-border bg-ds-card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">Expiring (60d)</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{expiring.length}</p>
        </div>
        <div className="rounded-xl border border-ds-border bg-ds-card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">Registry codes</p>
          <p className="mt-1 text-2xl font-bold text-ds-foreground">{registry.length}</p>
        </div>
      </section>

      <section className="ds-premium-panel overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-ds-border text-left text-xs font-bold uppercase tracking-wide text-ds-muted">
              <th className="px-3 py-2">Worker</th>
              <th className="px-3 py-2">Certification</th>
              <th className="px-3 py-2">Expiry</th>
              <th className="px-3 py-2">Competency</th>
              <th className="px-3 py-2">Verification</th>
              <th className="px-3 py-2">Proof</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ds-muted">
                  {api ? "No registry-matched certifications on file." : "Enable API mode to load worker certifications."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-ds-border/60">
                  <td className="px-3 py-2 font-medium text-ds-foreground">{r.workerName}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-ds-muted">{r.registryCode}</span> {r.label}
                  </td>
                  <td className="px-3 py-2 text-ds-muted">{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2 capitalize">{r.competencyState.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 capitalize">{r.verificationStatus}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-xs text-ds-muted">
                      <Upload className="h-3.5 w-3.5" aria-hidden />
                      {r.proofDocumentUrl ? "Uploaded" : "Pending upload"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
