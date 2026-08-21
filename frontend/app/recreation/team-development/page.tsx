"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { listOpsRecords, type OpsRecord } from "@/lib/recreation/opsService";
import {
  PROFICIENCY_LEVELS,
  TEAM_RISK_TYPES,
  createDevelopmentPlan,
  createSkill,
  createTeamRisk,
  deleteDevelopmentPlan,
  deleteSkill,
  deleteTeamRisk,
  listDevelopmentPlans,
  listSkillRatings,
  listSkills,
  listTeamRisks,
  patchDevelopmentPlan,
  patchTeamRisk,
  upsertSkillRating,
  type OpsDevelopmentPlan,
  type OpsSkill,
  type OpsSkillRating,
  type OpsTeamRisk,
} from "@/lib/recreation/commandService";

const inputClass =
  "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm text-ds-foreground outline-none focus:border-ds-primary";
const btnPrimary =
  "rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";

type Tab = "skills" | "plans" | "risks";

export default function TeamDevelopmentPage() {
  const [tab, setTab] = useState<Tab>("skills");
  const [people, setPeople] = useState<OpsRecord[]>([]);
  const [skills, setSkills] = useState<OpsSkill[]>([]);
  const [ratings, setRatings] = useState<OpsSkillRating[]>([]);
  const [plans, setPlans] = useState<OpsDevelopmentPlan[]>([]);
  const [risks, setRisks] = useState<OpsTeamRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skillName, setSkillName] = useState("");
  const [ratingDraft, setRatingDraft] = useState({
    skill_id: "",
    person_id: "",
    proficiency: "competent",
  });
  const [planDraft, setPlanDraft] = useState({ person_id: "", title: "Development plan" });
  const [riskDraft, setRiskDraft] = useState({
    title: "",
    risk_type: "skill_shortage",
    severity: "medium",
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, s, r, pl, rk] = await Promise.all([
        listOpsRecords("people"),
        listSkills(),
        listSkillRatings(),
        listDevelopmentPlans(),
        listTeamRisks(),
      ]);
      setPeople(p);
      setSkills(s);
      setRatings(r);
      setPlans(pl);
      setRisks(rk);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load team development");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const ratingKey = useMemo(() => {
    const m = new Map<string, OpsSkillRating>();
    for (const r of ratings) m.set(`${r.skill_id}:${r.person_id}`, r);
    return m;
  }, [ratings]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "skills", label: "Skills matrix" },
    { id: "plans", label: "Development plans" },
    { id: "risks", label: "Team risks" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Development"
        description="Skills matrix, development plans, and staffing/knowledge risks — operational, not HR."
        icon={GraduationCap}
      />
      <PageBody>
        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        <p className="mb-4 text-sm text-ds-muted">
          People come from the{" "}
          <Link href="/recreation/people" className="underline text-ds-primary">
            People
          </Link>{" "}
          directory. Set reporting lines on the{" "}
          <Link href="/recreation/org-chart" className="underline text-ds-primary">
            Org Chart
          </Link>
          .
        </p>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-ds-border pb-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === t.id ? "bg-ds-primary text-white" : "text-ds-muted hover:bg-ds-card"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-ds-muted">Loading…</p>
        ) : (
          <>
            {tab === "skills" ? (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <input
                    className={`${inputClass} max-w-xs`}
                    placeholder="New skill name"
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                  />
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!skillName.trim()}
                    onClick={async () => {
                      const row = await createSkill({ name: skillName.trim() });
                      setSkills((prev) => [...prev, row]);
                      setSkillName("");
                    }}
                  >
                    Add skill
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 rounded-xl border border-ds-border bg-ds-card p-3">
                  <select
                    className={inputClass}
                    value={ratingDraft.skill_id}
                    onChange={(e) => setRatingDraft({ ...ratingDraft, skill_id: e.target.value })}
                  >
                    <option value="">Skill…</option>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputClass}
                    value={ratingDraft.person_id}
                    onChange={(e) => setRatingDraft({ ...ratingDraft, person_id: e.target.value })}
                  >
                    <option value="">Person…</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputClass}
                    value={ratingDraft.proficiency}
                    onChange={(e) => setRatingDraft({ ...ratingDraft, proficiency: e.target.value })}
                  >
                    {PROFICIENCY_LEVELS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!ratingDraft.skill_id || !ratingDraft.person_id}
                    onClick={async () => {
                      const row = await upsertSkillRating(ratingDraft);
                      setRatings((prev) => {
                        const without = prev.filter(
                          (x) => !(x.skill_id === row.skill_id && x.person_id === row.person_id),
                        );
                        return [...without, row];
                      });
                    }}
                  >
                    Set rating
                  </button>
                </div>

                {skills.length && people.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[36rem] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-ds-border text-left text-xs uppercase text-ds-muted">
                          <th className="py-2 pr-2">Skill</th>
                          {people.map((p) => (
                            <th key={p.id} className="px-2 py-2 font-medium normal-case">
                              {p.title}
                            </th>
                          ))}
                          <th className="py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {skills.map((s) => (
                          <tr key={s.id} className="border-b border-ds-border/50">
                            <td className="py-2 pr-2 font-medium">{s.name}</td>
                            {people.map((p) => {
                              const r = ratingKey.get(`${s.id}:${p.id}`);
                              return (
                                <td key={p.id} className="px-2 py-2 text-xs capitalize text-ds-muted">
                                  {r?.proficiency ?? "—"}
                                  {r?.training_required ? " · training" : ""}
                                </td>
                              );
                            })}
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                className="text-xs text-red-700"
                                onClick={async () => {
                                  await deleteSkill(s.id);
                                  setSkills((prev) => prev.filter((x) => x.id !== s.id));
                                  setRatings((prev) => prev.filter((x) => x.skill_id !== s.id));
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
                ) : (
                  <p className="text-sm text-ds-muted">Add skills and people to build the matrix.</p>
                )}
              </div>
            ) : null}

            {tab === "plans" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <select
                    className={inputClass}
                    value={planDraft.person_id}
                    onChange={(e) => setPlanDraft({ ...planDraft, person_id: e.target.value })}
                  >
                    <option value="">Person…</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${inputClass} max-w-xs`}
                    value={planDraft.title}
                    onChange={(e) => setPlanDraft({ ...planDraft, title: e.target.value })}
                  />
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!planDraft.person_id}
                    onClick={async () => {
                      const row = await createDevelopmentPlan(planDraft);
                      setPlans((prev) => [row, ...prev]);
                    }}
                  >
                    Add plan
                  </button>
                </div>
                <ul className="space-y-3">
                  {plans.map((plan) => (
                    <li key={plan.id} className="rounded-xl border border-ds-border bg-ds-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{plan.title}</p>
                          <p className="text-xs text-ds-muted">
                            {plan.person_name ?? plan.person_id} · {plan.progress} · {plan.status}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-red-700"
                          onClick={async () => {
                            await deleteDevelopmentPlan(plan.id);
                            setPlans((prev) => prev.filter((x) => x.id !== plan.id));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                      <textarea
                        className={`${inputClass} mt-3`}
                        rows={2}
                        placeholder="Development goals"
                        value={plan.development_goals ?? ""}
                        onChange={(e) =>
                          setPlans((prev) =>
                            prev.map((x) =>
                              x.id === plan.id ? { ...x, development_goals: e.target.value } : x,
                            ),
                          )
                        }
                        onBlur={async () => {
                          await patchDevelopmentPlan(plan.id, {
                            development_goals: plan.development_goals,
                          });
                        }}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <select
                          className={inputClass}
                          value={plan.progress}
                          onChange={async (e) => {
                            const next = await patchDevelopmentPlan(plan.id, { progress: e.target.value });
                            setPlans((prev) => prev.map((x) => (x.id === plan.id ? next : x)));
                          }}
                        >
                          <option value="not_started">Not started</option>
                          <option value="in_progress">In progress</option>
                          <option value="complete">Complete</option>
                        </select>
                      </div>
                    </li>
                  ))}
                  {!plans.length ? (
                    <p className="text-sm text-ds-muted">No development plans yet.</p>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {tab === "risks" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <input
                    className={`${inputClass} min-w-[14rem] flex-1`}
                    placeholder="Risk title"
                    value={riskDraft.title}
                    onChange={(e) => setRiskDraft({ ...riskDraft, title: e.target.value })}
                  />
                  <select
                    className={inputClass}
                    value={riskDraft.risk_type}
                    onChange={(e) => setRiskDraft({ ...riskDraft, risk_type: e.target.value })}
                  >
                    {TEAM_RISK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputClass}
                    value={riskDraft.severity}
                    onChange={(e) => setRiskDraft({ ...riskDraft, severity: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!riskDraft.title.trim()}
                    onClick={async () => {
                      const row = await createTeamRisk(riskDraft);
                      setRisks((prev) => [row, ...prev]);
                      setRiskDraft({ title: "", risk_type: "skill_shortage", severity: "medium" });
                    }}
                  >
                    Add risk
                  </button>
                </div>
                <ul className="space-y-3">
                  {risks.map((risk) => (
                    <li key={risk.id} className="rounded-xl border border-ds-border bg-ds-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{risk.title}</p>
                          <p className="text-xs text-ds-muted">
                            {risk.risk_type.replace(/_/g, " ")} · {risk.severity} · {risk.status}
                            {risk.person_name ? ` · ${risk.person_name}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-red-700"
                          onClick={async () => {
                            await deleteTeamRisk(risk.id);
                            setRisks((prev) => prev.filter((x) => x.id !== risk.id));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                      <textarea
                        className={`${inputClass} mt-3`}
                        rows={2}
                        placeholder="Description / mitigation"
                        value={risk.description ?? ""}
                        onChange={(e) =>
                          setRisks((prev) =>
                            prev.map((x) => (x.id === risk.id ? { ...x, description: e.target.value } : x)),
                          )
                        }
                        onBlur={async () => {
                          await patchTeamRisk(risk.id, { description: risk.description });
                        }}
                      />
                      <select
                        className={`${inputClass} mt-2 max-w-xs`}
                        value={risk.status}
                        onChange={async (e) => {
                          const next = await patchTeamRisk(risk.id, { status: e.target.value });
                          setRisks((prev) => prev.map((x) => (x.id === risk.id ? next : x)));
                        }}
                      >
                        <option value="open">Open</option>
                        <option value="monitoring">Monitoring</option>
                        <option value="mitigated">Mitigated</option>
                        <option value="closed">Closed</option>
                      </select>
                    </li>
                  ))}
                  {!risks.length ? <p className="text-sm text-ds-muted">No team risks logged.</p> : null}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </PageBody>
    </div>
  );
}
