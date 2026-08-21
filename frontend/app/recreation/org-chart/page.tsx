"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Network } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { listOpsRecords, patchOpsRecord, type OpsRecord } from "@/lib/recreation/opsService";
import { fetchOrgChart, type OpsOrgNode } from "@/lib/recreation/commandService";

const inputClass =
  "rounded-lg border border-ds-border bg-ds-bg px-2 py-1.5 text-sm text-ds-foreground outline-none focus:border-ds-primary";

function OrgNodeCard({
  node,
  people,
  onSetManager,
  depth = 0,
}: {
  node: OpsOrgNode;
  people: OpsRecord[];
  onSetManager: (personId: string, managerId: string | null) => Promise<void>;
  depth?: number;
}) {
  return (
    <li className="relative">
      <div
        className="rounded-xl border border-ds-border bg-ds-card p-3 shadow-sm"
        style={{ marginLeft: depth * 12 }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Link
              href={`/recreation/people?id=${node.id}`}
              className="font-semibold text-ds-foreground hover:underline"
            >
              {node.title}
            </Link>
            <p className="text-xs text-ds-muted">
              {[node.position, node.role_label, node.department, node.team_name].filter(Boolean).join(" · ") ||
                "No role details yet"}
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-ds-muted">
            Reports to
            <select
              className={inputClass}
              value={node.reports_to_person_id ?? ""}
              onChange={(e) => void onSetManager(node.id, e.target.value || null)}
            >
              <option value="">— none —</option>
              {people
                .filter((p) => p.id !== node.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </div>
      {node.children?.length ? (
        <ul className="mt-3 space-y-3 border-l border-ds-border/70 pl-3">
          {node.children.map((child) => (
            <OrgNodeCard
              key={child.id}
              node={child}
              people={people}
              onSetManager={onSetManager}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function OrgChartPage() {
  const [roots, setRoots] = useState<OpsOrgNode[]>([]);
  const [people, setPeople] = useState<OpsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chart, roster] = await Promise.all([fetchOrgChart(), listOpsRecords("people")]);
      setRoots(chart);
      setPeople(roster);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load org chart");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSetManager(personId: string, managerId: string | null) {
    await patchOpsRecord("people", personId, { reports_to_person_id: managerId });
    await reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Org Chart"
        description="Operational hierarchy — departments, teams, and reporting relationships. Click a name to open their person record."
        icon={Network}
      />
      <PageBody>
        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <Link href="/recreation/people" className="underline text-ds-primary">
            Manage people directory
          </Link>
          <span className="text-ds-muted">·</span>
          <Link href="/recreation/team-development" className="underline text-ds-primary">
            Team development
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-ds-muted">Loading…</p>
        ) : roots.length ? (
          <ul className="space-y-4">
            {roots.map((node) => (
              <OrgNodeCard key={node.id} node={node} people={people} onSetManager={onSetManager} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ds-muted">
            No people yet. Add operational people in{" "}
            <Link href="/recreation/people" className="underline">
              People
            </Link>
            , then set reporting lines here.
          </p>
        )}
      </PageBody>
    </div>
  );
}
