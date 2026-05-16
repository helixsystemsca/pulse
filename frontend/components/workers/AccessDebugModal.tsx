"use client";

import { Loader2, X } from "lucide-react";
import { useMemo } from "react";
import {
  MASTER_FEATURES,
  NAV_VISIBLE_MASTER_FEATURES,
} from "@/config/platform/master-feature-registry";
import { MODULE_LABEL } from "@/config/platform/tenant-product-modules";
import type {
  AccessResolutionDebugPayload,
  MissingFeatureExplanation,
  ResolvedAccessAudit,
} from "@/lib/accessDebugService";
import { diagnoseAccessNav, formatMissingReason } from "@/lib/accessDebugNavDiagnosis";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { toCanonicalFeatureKey } from "@/lib/features/canonical-features";
import { isFallbackTeamMember, isPolicySuppressedSlot } from "@/lib/rbac/matrix-slot-policy";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

function formatSlotSource(source: string): string {
  const labels: Record<string, string> = {
    explicit_matrix_slot: "Explicit matrix_slot (HR)",
    jwt_role: "JWT role tier",
    job_title_inference: "Job title keyword inference",
    fallback_default: "Fallback default (team_member)",
    department_default: "HR department default",
    explicit_required_policy: "Policy: explicit HR matrix_slot required",
  };
  return labels[source] ?? source;
}

function labelForFeatureKey(raw: string): string {
  const c = toCanonicalFeatureKey(raw);
  if (c && Object.prototype.hasOwnProperty.call(MODULE_LABEL, c)) {
    return MODULE_LABEL[c as keyof typeof MODULE_LABEL];
  }
  if (Object.prototype.hasOwnProperty.call(MODULE_LABEL, raw)) {
    return MODULE_LABEL[raw as keyof typeof MODULE_LABEL];
  }
  return raw;
}

function sortedCopy(xs: readonly string[]): string[] {
  return [...xs].map(String).sort();
}

function arraysEqualSorted(a: readonly string[], b: readonly string[]): boolean {
  const x = sortedCopy(a);
  const y = sortedCopy(b);
  if (x.length !== y.length) return false;
  return x.every((v, i) => v === y[i]);
}

function MissingFeatureCard({ row }: { row: MissingFeatureExplanation }) {
  return (
    <li className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ds-foreground">{labelForFeatureKey(row.feature_key)}</span>
        <span className="font-mono text-[10px] text-pulse-muted">{row.feature_key}</span>
      </div>
      <p className="mt-1 text-red-200/90">Not granted — {formatMissingReason(row.missing_reason)}</p>
      {row.denied_by.length ? (
        <p className="mt-1 text-pulse-muted">
          Denied by: <span className="font-mono">{row.denied_by.join(", ")}</span>
        </p>
      ) : null}
      {row.expected_from.length ? (
        <p className="mt-0.5 text-pulse-muted">
          Expected from: <span className="font-mono">{row.expected_from.join(", ")}</span>
        </p>
      ) : null}
      {row.resolution_details.length ? (
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-pulse-muted">
          {row.resolution_details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Session shape the sidebar resolves against for the worker being inspected. */
function buildTargetPulseSession(debug: AccessResolutionDebugPayload, viewer: PulseAuthSession | null): PulseAuthSession {
  const roles = debug.jwt_roles?.length ? [...debug.jwt_roles] : ["worker"];
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: debug.user_id,
    email: viewer?.email ?? "(target user)",
    role: roles[0],
    roles,
    company_id: debug.company_id ?? viewer?.company_id ?? null,
    enabled_features: debug.effective_enabled_features,
    rbac_permissions: debug.rbac_permission_keys,
    contract_features: debug.contract_features,
    contract_enabled_features: viewer?.contract_enabled_features ?? debug.contract_features,
    feature_allow_extra: debug.feature_allow_extra,
    tenant_role_id: debug.tenant_role_id,
    workers_roster_access: false,
    facility_tenant_admin: false,
    is_system_admin: false,
    iat: now,
    exp: now + 3600,
    remember: false,
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  debug: AccessResolutionDebugPayload | null;
  resolvedAudit?: ResolvedAccessAudit | null;
  /** Signed-in admin (or system) session — not the target user's JWT. */
  viewerSession: PulseAuthSession | null;
};

export function AccessDebugModal({ open, onClose, loading, error, debug, resolvedAudit, viewerSession }: Props) {
  const targetNavSession = debug ? buildTargetPulseSession(debug, viewerSession) : null;

  const navDiag = useMemo(() => {
    if (!debug || !targetNavSession) return null;
    return diagnoseAccessNav(debug, targetNavSession);
  }, [debug, targetNavSession]);

  const contractMissing = useMemo(() => {
    if (!debug?.missing_feature_explanations?.length) return [];
    return debug.missing_feature_explanations.filter((m) => m.missing_reason === "filtered_by_contract");
  }, [debug]);

  const matrixMissing = useMemo(() => {
    if (!debug?.missing_feature_explanations?.length) return [];
    return debug.missing_feature_explanations.filter((m) =>
      ["disabled_in_matrix", "slot_mismatch", "matrix_cell_empty", "overlay_ignored_under_matrix_primary"].includes(
        m.missing_reason,
      ),
    );
  }, [debug]);

  const otherMissing = useMemo(() => {
    if (!debug?.missing_feature_explanations?.length) return [];
    const shown = new Set([...contractMissing, ...matrixMissing].map((m) => m.feature_key));
    return debug.missing_feature_explanations.filter((m) => !shown.has(m.feature_key));
  }, [debug, contractMissing, matrixMissing]);

  const featsMismatchVsViewer =
    debug && viewerSession && viewerSession.sub === debug.user_id && !arraysEqualSorted(viewerSession.enabled_features ?? [], debug.effective_enabled_features);
  const rbacMismatchVsViewer =
    debug && viewerSession && viewerSession.sub === debug.user_id && !arraysEqualSorted(viewerSession.rbac_permissions ?? [], debug.rbac_permission_keys);

  if (!open) return null;

  return (
    <div
      className="ds-modal-backdrop fixed inset-0 z-[280] flex items-center justify-center p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-debug-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-ds-border bg-ds-primary shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-ds-border px-5 py-4">
          <div>
            <h2 id="access-debug-title" className="text-lg font-semibold text-ds-foreground">
              Debug access resolution
            </h2>
            <p className="mt-1 max-w-[52ch] text-xs text-pulse-muted">
              Server-side production resolver output for this user ID. Sidebar simulation uses{" "}
              <code className="text-[11px]">tenant-nav</code> with a session synthesized from{" "}
              <code className="text-[11px]">effective_enabled_features</code>.
            </p>
          </div>
          <button
            type="button"
            className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "shrink-0 px-2 py-1.5")}
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-pulse-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Loading resolver snapshot…
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
          ) : null}

          {!loading && debug ? (
            <div className="space-y-8">
              {viewerSession && viewerSession.sub !== debug.user_id ? (
                <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-50">
                  You are inspecting <strong>{debug.user_id}</strong> while signed in as <strong>{viewerSession.sub}</strong>.
                  Values under &quot;Your browser session&quot; are yours, not theirs — compare to the simulated target session
                  for sidebar truth.
                </section>
              ) : null}

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">Resolution</h3>
                <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-pulse-muted">Kind</dt>
                    <dd className="font-mono">{debug.resolution_kind}</dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">Matrix configured</dt>
                    <dd>{debug.matrix_configured ? "yes" : "no"}</dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">Resolved slot</dt>
                    <dd className="font-mono">{debug.resolved_slot ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">Resolved from</dt>
                    <dd className="font-mono">{formatSlotSource(debug.resolved_slot_source ?? "")}</dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">HR matrix_slot (stored)</dt>
                    <dd className="font-mono">{debug.hr_matrix_slot ?? "— (auto)"}</dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">Resolved department</dt>
                    <dd className="font-mono">{debug.resolved_department ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">HR job title</dt>
                    <dd className="font-mono">{debug.hr_job_title ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">User job title</dt>
                    <dd className="font-mono">{debug.user_job_title ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">Effective job title (authorization)</dt>
                    <dd className="font-mono">{debug.effective_job_title ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">HR department</dt>
                    <dd className="font-mono">{debug.hr_department ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">JWT roles</dt>
                    <dd className="font-mono">{(debug.jwt_roles ?? []).join(", ") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">Tenant role</dt>
                    <dd className="font-mono">
                      {debug.tenant_role_slug ?? "—"} {debug.tenant_role_name ? `(${debug.tenant_role_name})` : ""}
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">Feature layers</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-pulse-muted">
                  <li>
                    <span className="text-ds-foreground">Contract: </span>
                    {sortedCopy(debug.contract_features).join(", ") || "—"}
                  </li>
                  <li>
                    <span className="text-ds-foreground">Matrix (after ∩ contract): </span>
                    {sortedCopy(debug.matrix_features).join(", ") || "—"}
                  </li>
                  <li>
                    <span className="text-ds-foreground">Overlay role feature_keys (informational): </span>
                    {sortedCopy(debug.overlay_features).join(", ") || "—"}
                  </li>
                  <li>
                    <span className="text-ds-foreground">feature_allow_extra: </span>
                    {sortedCopy(debug.feature_allow_extra).join(", ") || "—"}
                  </li>
                  <li>
                    <span className="text-ds-foreground">permission_deny (coarse): </span>
                    {sortedCopy(debug.feature_deny_extra).join(", ") || "—"}
                  </li>
                  <li>
                    <span className="text-ds-foreground">Filtered by contract (raw cell canon): </span>
                    {sortedCopy(debug.denied_by_contract).join(", ") || "—"}
                  </li>
                  <li>
                    <span className="text-ds-foreground">Matrix cell raw (before contract): </span>
                    <span className="font-mono">{(debug.matrix_cell_raw_features ?? []).join(", ") || "—"}</span>
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">Final server lists</h3>
                <p className="mt-1 text-xs text-pulse-muted">These should match <code>/auth/me</code> for the target user after a fresh token.</p>
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-ds-secondary p-3 text-[11px] leading-relaxed text-ds-foreground">
                  enabled_features ({debug.effective_enabled_features.length}
                  ): {JSON.stringify(sortedCopy(debug.effective_enabled_features))}
                  {"\n"}
                  rbac_permissions ({debug.rbac_permission_keys.length}
                  ): {JSON.stringify(sortedCopy(debug.rbac_permission_keys))}
                </pre>
              </section>

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">Granted features (server)</h3>
                <p className="mt-1 text-xs text-pulse-muted">
                  Production <code>effective_enabled_features</code> and <code>source_attribution</code>.
                </p>
                <div className="mt-2 overflow-x-auto rounded-lg border border-ds-border">
                  <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
                    <thead className="bg-ds-secondary text-pulse-muted">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Module</th>
                        <th className="px-3 py-2 font-semibold">Key</th>
                        <th className="px-3 py-2 font-semibold">Why (server)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCopy(debug.effective_enabled_features).map((k) => (
                        <tr key={k} className="border-t border-ds-border">
                          <td className="px-3 py-2">{labelForFeatureKey(k)}</td>
                          <td className="px-3 py-2 font-mono text-[11px]">{k}</td>
                          <td className="px-3 py-2 text-pulse-muted">{debug.source_attribution[k] ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">Missing features (server)</h3>
                <p className="mt-1 text-xs text-pulse-muted">
                  Candidate universe ({debug.candidate_feature_keys?.length ?? 0} keys) minus granted — inverse of{" "}
                  <code>source_attribution</code>.
                </p>
                {matrixMissing.length ? (
                  <>
                    <p className="mt-3 text-[11px] font-semibold uppercase text-pulse-muted">Matrix / slot / overlay</p>
                    <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                      {matrixMissing.map((m) => (
                        <MissingFeatureCard key={m.feature_key} row={m} />
                      ))}
                    </ul>
                  </>
                ) : null}
                {contractMissing.length ? (
                  <>
                    <p className="mt-3 text-[11px] font-semibold uppercase text-pulse-muted">Contract</p>
                    <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                      {contractMissing.map((m) => (
                        <MissingFeatureCard key={m.feature_key} row={m} />
                      ))}
                    </ul>
                  </>
                ) : null}
                {otherMissing.length ? (
                  <>
                    <p className="mt-3 text-[11px] font-semibold uppercase text-pulse-muted">Other</p>
                    <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                      {otherMissing.map((m) => (
                        <MissingFeatureCard key={m.feature_key} row={m} />
                      ))}
                    </ul>
                  </>
                ) : null}
                {!debug.missing_feature_explanations?.length ? (
                  <p className="mt-2 text-xs text-pulse-muted">No missing keys in candidate universe.</p>
                ) : null}
              </section>

              {debug.missing_rbac_permission_keys?.length ? (
                <section>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">Missing RBAC keys (bridge)</h3>
                  <p className="mt-1 text-xs text-pulse-muted">
                    Expected from FEATURE_TO_RBAC bridge for effective features but absent from{" "}
                    <code>rbac_permission_keys</code>.
                  </p>
                  <pre className="mt-2 rounded-lg bg-ds-secondary p-3 text-[11px]">
                    {JSON.stringify(debug.missing_rbac_permission_keys)}
                  </pre>
                </section>
              ) : null}

              {isPolicySuppressedSlot(debug.resolved_slot_source) ? (
                <section className="rounded-lg border-2 border-violet-500/50 bg-violet-500/15 px-4 py-3 text-sm text-violet-50">
                  <p className="font-bold uppercase tracking-wide">Policy suppressed inferred matrix slot</p>
                  <p className="mt-2">
                    <span className="font-mono">REQUIRE_EXPLICIT_ELEVATED_SLOTS</span> is enabled. Inference succeeded
                    {debug.suppressed_inferred_slot ? (
                      <>
                        {" "}
                        (would use <span className="font-mono">{debug.suppressed_inferred_slot}</span>)
                      </>
                    ) : null}
                    , but authorization uses <span className="font-mono">team_member</span> until explicit HR{" "}
                    <span className="font-mono">matrix_slot</span> is set.
                  </p>
                  {debug.matrix_slot_inference_trace?.length ? (
                    <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-violet-100/90">
                      {debug.matrix_slot_inference_trace.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : isFallbackTeamMember(debug.resolved_slot_source, debug.resolved_slot) ? (
                <section className="rounded-lg border-2 border-red-500/60 bg-red-500/15 px-4 py-3 text-sm text-red-50">
                  <p className="font-bold uppercase tracking-wide">Authorization uses fallback team_member</p>
                  <p className="mt-2">
                    No explicit <span className="font-mono">matrix_slot</span> exists on this worker&apos;s HR record.
                    The permission matrix row defaults to <span className="font-mono">team_member</span> — coordinator and
                    elevated modules will not resolve unless you assign an explicit slot.
                  </p>
                  {debug.recommended_matrix_slot ? (
                    <p className="mt-2">
                      Recommended fix: set matrix_slot to{" "}
                      <span className="font-mono font-semibold">{debug.recommended_matrix_slot}</span> and re-login.
                    </p>
                  ) : null}
                  {debug.matrix_slot_inference_trace?.length ? (
                    <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-red-100/90">
                      {debug.matrix_slot_inference_trace.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : debug.resolved_slot_source && debug.resolved_slot_source !== "explicit_matrix_slot" ? (
                <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-50">
                  Matrix slot is inferred ({formatSlotSource(debug.resolved_slot_source)}). Set an explicit{" "}
                  <span className="font-mono">matrix_slot</span> on the worker HR profile for stable access.
                  {debug.recommended_matrix_slot ? (
                    <span className="mt-1 block">
                      Suggested: <span className="font-mono">{debug.recommended_matrix_slot}</span>
                    </span>
                  ) : null}
                </section>
              ) : null}

              {resolvedAudit ? (
                <section>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">
                    Cross-layer resolution audit
                  </h3>
                  <p className="mt-1 text-xs text-pulse-muted">
                    Server simulation of sidebar, route, API, and render gates per feature. Department hub:{" "}
                    <span className="font-mono">
                      {String(resolvedAudit.workspace_context?.department_hub_allowed ?? "—")}
                    </span>
                    .
                  </p>
                  <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-ds-border">
                    <table className="w-full text-left text-[10px]">
                      <thead className="sticky top-0 bg-ds-secondary text-pulse-muted">
                        <tr>
                          <th className="px-2 py-1">Feature</th>
                          <th className="px-2 py-1">Nav</th>
                          <th className="px-2 py-1">Route</th>
                          <th className="px-2 py-1">Render</th>
                          <th className="px-2 py-1">Failure</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resolvedAudit.feature_resolution_log
                          .filter((e) => e.registry_key?.startsWith("comms_") || e.registry_key === "xplor_indesign")
                          .map((e) => (
                            <tr key={e.feature_key} className="border-t border-ds-border/50">
                              <td className="px-2 py-1 font-mono">{e.registry_key ?? e.feature_key}</td>
                              <td className="px-2 py-1">{e.sidebar_visible ? "✓" : "—"}</td>
                              <td className="px-2 py-1">{e.route_allowed ? "✓" : "—"}</td>
                              <td className="px-2 py-1">{e.render_allowed ? "✓" : "—"}</td>
                              <td className="px-2 py-1 text-pulse-muted">{e.failure_reason ?? "—"}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {resolvedAudit.workspace_context?.publication_builder ? (
                    <pre className="mt-2 max-h-28 overflow-auto rounded-lg bg-ds-secondary p-2 text-[10px]">
                      {JSON.stringify(resolvedAudit.workspace_context.publication_builder, null, 2)}
                    </pre>
                  ) : null}
                </section>
              ) : null}

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">Sidebar granted (simulated)</h3>
                <p className="mt-1 text-xs text-pulse-muted">
                  Uses the same rules as the live app sidebar: contract ∩ enabled_features ∩ RBAC (plus team-management / settings
                  exceptions).
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {(navDiag?.simulatedSidebar ?? []).map((n) => {
                    const feat = MASTER_FEATURES.find((f) => f.key === n.key)?.feature ?? n.key;
                    const canonKey = String(toCanonicalFeatureKey(feat) ?? feat);
                    const why =
                      debug.source_attribution[feat] ?? debug.source_attribution[canonKey] ?? "—";
                    return (
                      <li key={n.key} className="rounded border border-ds-border bg-ds-secondary/40 px-2 py-1.5">
                        <span className="font-medium text-ds-foreground">{n.label}</span>
                        <span className="text-pulse-muted"> ({n.key})</span>
                        <div className="mt-0.5 text-[11px] text-pulse-muted">→ {why}</div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">Sidebar hidden modules</h3>
                <p className="mt-1 text-xs text-pulse-muted">
                  Nav registry entries not rendered — <code>explainMasterFeatureVisibility</code> failing gate.
                </p>
                <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto text-xs">
                  {(navDiag?.rows ?? [])
                    .filter((r) => !r.inSimulatedSidebar)
                    .map((r) => (
                      <li key={r.registryKey} className="rounded border border-ds-border/60 px-2 py-1.5 text-pulse-muted">
                        <span className="font-medium text-ds-foreground">{r.label}</span> ({r.registryKey})
                        <div className="mt-1 text-[11px]">
                          {r.inEnabledFeatures ? (
                            <span className="text-amber-200">
                              enabled_features includes {r.canonicalFeature} — frontend sidebar hidden
                            </span>
                          ) : (
                            <span>Not in effective_enabled_features (server)</span>
                          )}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px]">{r.frontendHiddenReason ?? "—"}</div>
                        {r.missingServerExplanation ? (
                          <div className="mt-1 text-[10px]">
                            Server: {formatMissingReason(r.missingServerExplanation.missing_reason)}
                          </div>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </section>

              {navDiag?.frontendHidden.length ? (
                <section>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">
                    Enabled on server but hidden in nav
                  </h3>
                  <p className="mt-1 text-xs text-pulse-muted">
                    Backend granted the module; <code>tenant-nav.ts</code> still filters the sidebar item (often RBAC).
                  </p>
                  <ul className="mt-2 space-y-2 text-xs">
                    {navDiag.frontendHidden.map((r) => (
                      <li key={r.registryKey} className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5">
                        <span className="font-semibold text-ds-foreground">{r.label}</span> ({r.feature})
                        <div className="mt-1 text-pulse-muted">{r.frontendHiddenReason}</div>
                        {r.serverAttribution ? (
                          <div className="mt-0.5 text-[11px]">Server attribution: {r.serverAttribution}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">Nav diff (enabled_features vs sidebar)</h3>
                <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-ds-secondary p-3 text-[11px]">
                  {JSON.stringify(
                    {
                      enabled_features: sortedCopy(debug.effective_enabled_features),
                      sidebar_keys: sortedCopy([...(navDiag?.sidebarKeys ?? [])]),
                      registry_nav_visible: NAV_VISIBLE_MASTER_FEATURES.map((f) => f.key),
                    },
                    null,
                    2,
                  )}
                </pre>
              </section>

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">Your browser session (viewer)</h3>
                <p className="mt-1 text-xs text-pulse-muted">
                  Raw <code>session.enabled_features</code> / <code>session.rbac_permissions</code> from this tab. If you are not
                  impersonating the target user, expect mismatch vs the server block above.
                </p>
                <pre className="mt-2 max-h-36 overflow-auto rounded-lg bg-ds-secondary p-3 text-[11px]">
                  enabled_features: {JSON.stringify(sortedCopy(viewerSession?.enabled_features ?? []))}
                  {"\n"}
                  rbac_permissions: {JSON.stringify(sortedCopy(viewerSession?.rbac_permissions ?? []))}
                </pre>
                {viewerSession?.sub === debug.user_id && (featsMismatchVsViewer || rbacMismatchVsViewer) ? (
                  <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-50">
                    Mismatch: your stored session lists differ from the server snapshot — try hard refresh, re-login, or call{" "}
                    <code className="text-[10px]">refreshPulseUserFromServer()</code>.
                  </p>
                ) : null}
              </section>

              {debug.warnings?.length ? (
                <section>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">Warnings</h3>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-100/90">
                    {debug.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">Resolution steps</h3>
                <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-pulse-muted">
                  {debug.resolution_steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
