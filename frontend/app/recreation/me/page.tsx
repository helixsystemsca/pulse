"use client";

import { useCallback, useEffect, useState } from "react";
import { User } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  AUTHORITY_LEVELS,
  PHILOSOPHY_LABELS,
  createAuthority,
  createResponsibility,
  deleteAuthority,
  deleteResponsibility,
  fetchProfile,
  listAuthority,
  listResponsibilities,
  patchAuthority,
  patchProfile,
  patchResponsibility,
  type OpsAuthorityRow,
  type OpsPersonalProfile,
  type OpsRoleResponsibility,
} from "@/lib/recreation/commandService";

const inputClass =
  "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm text-ds-foreground outline-none focus:border-ds-primary";
const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted";
const btnPrimary =
  "rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-ds-border px-3 py-1.5 text-sm text-ds-foreground hover:bg-ds-card";

type Tab = "profile" | "philosophy" | "role" | "authority";

export default function RecreationMePage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<OpsPersonalProfile | null>(null);
  const [responsibilities, setResponsibilities] = useState<OpsRoleResponsibility[]>([]);
  const [authority, setAuthority] = useState<OpsAuthorityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newResp, setNewResp] = useState({ title: "", category: "Operations", priority: "medium" });
  const [newAuth, setNewAuth] = useState({ decision: "" });
  const [principleDraft, setPrincipleDraft] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, r, a] = await Promise.all([fetchProfile(), listResponsibilities(), listAuthority()]);
      setProfile(p);
      setResponsibilities(r);
      setAuthority(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveProfile(patch: Partial<OpsPersonalProfile>) {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const next = await patchProfile(patch);
      setProfile(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "philosophy", label: "Philosophy & principles" },
    { id: "role", label: "Role & responsibilities" },
    { id: "authority", label: "Authority matrix" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Your professional operating profile — philosophy, role purpose, responsibilities, and decision authority."
        icon={User}
      />
      <PageBody>
        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        {loading || !profile ? (
          <p className="text-sm text-ds-muted">Loading…</p>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap gap-2 border-b border-ds-border pb-3" data-tour="ops-me-tour-tabs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-tour={`ops-me-tour-tab-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    tab === t.id ? "bg-ds-primary text-white" : "text-ds-muted hover:bg-ds-card"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "profile" ? (
              <div className="grid max-w-3xl gap-4 sm:grid-cols-2" data-tour="ops-me-tour-profile">
                {(
                  [
                    ["display_name", "Display name"],
                    ["position", "Position"],
                    ["department", "Department"],
                    ["manager_name", "Manager"],
                    ["start_date", "Start date"],
                    ["contact_info", "Contact"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className={labelClass}>{label}</span>
                    <input
                      className={inputClass}
                      type={key === "start_date" ? "date" : "text"}
                      value={(profile[key] as string | null) ?? ""}
                      onChange={(e) => setProfile({ ...profile, [key]: e.target.value || null })}
                      onBlur={() => void saveProfile({ [key]: profile[key] })}
                    />
                  </label>
                ))}
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Notes</span>
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={profile.notes ?? ""}
                    onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
                    onBlur={() => void saveProfile({ notes: profile.notes })}
                  />
                </label>
                <p className="sm:col-span-2 text-xs text-ds-muted">
                  {saving ? "Saving…" : "Changes save when you leave a field."}
                </p>
              </div>
            ) : null}

            {tab === "philosophy" ? (
              <div className="max-w-3xl space-y-6" data-tour="ops-me-tour-philosophy">
                <label className="block">
                  <span className={labelClass}>Role purpose</span>
                  <textarea
                    className={inputClass}
                    rows={3}
                    placeholder="Why this role exists and what success looks like…"
                    value={profile.role_purpose ?? ""}
                    onChange={(e) => setProfile({ ...profile, role_purpose: e.target.value })}
                    onBlur={() => void saveProfile({ role_purpose: profile.role_purpose })}
                  />
                </label>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-ds-foreground">Philosophy</h3>
                  {Object.keys(PHILOSOPHY_LABELS).map((key) => (
                    <label key={key} className="block">
                      <span className={labelClass}>{PHILOSOPHY_LABELS[key]}</span>
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={profile.philosophy?.[key] ?? ""}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            philosophy: { ...profile.philosophy, [key]: e.target.value },
                          })
                        }
                        onBlur={() => void saveProfile({ philosophy: profile.philosophy })}
                      />
                    </label>
                  ))}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ds-foreground">Operating principles</h3>
                  <ul className="mb-3 space-y-2">
                    {(profile.principles || []).map((p, i) => (
                      <li key={`${p}-${i}`} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 text-ds-primary">•</span>
                        <span className="flex-1">{p}</span>
                        <button
                          type="button"
                          className="text-xs text-ds-muted hover:text-red-600"
                          onClick={() => {
                            const next = profile.principles.filter((_, idx) => idx !== i);
                            setProfile({ ...profile, principles: next });
                            void saveProfile({ principles: next });
                          }}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      placeholder="Add a principle…"
                      value={principleDraft}
                      onChange={(e) => setPrincipleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && principleDraft.trim()) {
                          e.preventDefault();
                          const next = [...(profile.principles || []), principleDraft.trim()];
                          setProfile({ ...profile, principles: next });
                          setPrincipleDraft("");
                          void saveProfile({ principles: next });
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => {
                        if (!principleDraft.trim()) return;
                        const next = [...(profile.principles || []), principleDraft.trim()];
                        setProfile({ ...profile, principles: next });
                        setPrincipleDraft("");
                        void saveProfile({ principles: next });
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "role" ? (
              <div className="max-w-3xl space-y-4" data-tour="ops-me-tour-role">
                <div className="flex flex-wrap gap-2 rounded-xl border border-ds-border bg-ds-card p-3">
                  <input
                    className={`${inputClass} min-w-[12rem] flex-1`}
                    placeholder="Responsibility title"
                    value={newResp.title}
                    onChange={(e) => setNewResp({ ...newResp, title: e.target.value })}
                  />
                  <input
                    className={`${inputClass} w-36`}
                    placeholder="Category"
                    value={newResp.category}
                    onChange={(e) => setNewResp({ ...newResp, category: e.target.value })}
                  />
                  <select
                    className={`${inputClass} w-28`}
                    value={newResp.priority}
                    onChange={(e) => setNewResp({ ...newResp, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!newResp.title.trim()}
                    onClick={async () => {
                      const row = await createResponsibility({
                        title: newResp.title.trim(),
                        category: newResp.category,
                        priority: newResp.priority,
                      });
                      setResponsibilities((prev) => [...prev, row]);
                      setNewResp({ title: "", category: "Operations", priority: "medium" });
                    }}
                  >
                    Add
                  </button>
                </div>
                <ul className="space-y-2">
                  {responsibilities.map((r) => (
                    <li key={r.id} className="rounded-xl border border-ds-border bg-ds-card p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-ds-foreground">{r.title}</p>
                          <p className="text-xs text-ds-muted">
                            {r.category} · {r.priority}
                            {r.frequency ? ` · ${r.frequency}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-ds-muted hover:text-red-600"
                          onClick={async () => {
                            await deleteResponsibility(r.id);
                            setResponsibilities((prev) => prev.filter((x) => x.id !== r.id));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                      <textarea
                        className={`${inputClass} mt-2`}
                        rows={2}
                        placeholder="Description"
                        value={r.description ?? ""}
                        onChange={(e) =>
                          setResponsibilities((prev) =>
                            prev.map((x) => (x.id === r.id ? { ...x, description: e.target.value } : x)),
                          )
                        }
                        onBlur={async () => {
                          await patchResponsibility(r.id, { description: r.description });
                        }}
                      />
                    </li>
                  ))}
                  {!responsibilities.length ? (
                    <p className="text-sm text-ds-muted">No responsibilities yet — add the work you own.</p>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {tab === "authority" ? (
              <div className="space-y-4 overflow-x-auto" data-tour="ops-me-tour-authority">
                <div className="flex flex-wrap gap-2">
                  <input
                    className={`${inputClass} max-w-md flex-1`}
                    placeholder="New decision type…"
                    value={newAuth.decision}
                    onChange={(e) => setNewAuth({ decision: e.target.value })}
                  />
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!newAuth.decision.trim()}
                    onClick={async () => {
                      const row = await createAuthority({
                        decision: newAuth.decision.trim(),
                        levels: { staff: false, coordinator: false, manager: false, director: false },
                        status: "unknown",
                      });
                      setAuthority((prev) => [...prev, row]);
                      setNewAuth({ decision: "" });
                    }}
                  >
                    Add decision
                  </button>
                </div>
                <table className="w-full min-w-[40rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-ds-border text-left text-xs uppercase tracking-wide text-ds-muted">
                      <th className="py-2 pr-3">Decision</th>
                      {AUTHORITY_LEVELS.map((l) => (
                        <th key={l} className="px-2 py-2 capitalize">
                          {l}
                        </th>
                      ))}
                      <th className="px-2 py-2">Status</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {authority.map((row) => (
                      <tr key={row.id} className="border-b border-ds-border/60">
                        <td className="py-2 pr-3 font-medium">{row.decision}</td>
                        {AUTHORITY_LEVELS.map((level) => (
                          <td key={level} className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(row.levels?.[level])}
                              onChange={async (e) => {
                                const levels = { ...row.levels, [level]: e.target.checked };
                                const next = await patchAuthority(row.id, { levels });
                                setAuthority((prev) => prev.map((x) => (x.id === row.id ? next : x)));
                              }}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          <select
                            className={inputClass}
                            value={row.status}
                            onChange={async (e) => {
                              const next = await patchAuthority(row.id, { status: e.target.value });
                              setAuthority((prev) => prev.map((x) => (x.id === row.id ? next : x)));
                            }}
                          >
                            <option value="unknown">Unknown</option>
                            <option value="need_to_confirm">Need to confirm</option>
                            <option value="confirmed">Confirmed</option>
                          </select>
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={async () => {
                              await deleteAuthority(row.id);
                              setAuthority((prev) => prev.filter((x) => x.id !== row.id));
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </PageBody>
    </div>
  );
}
