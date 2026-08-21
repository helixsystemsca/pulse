"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRecreationOpsBoard } from "@/hooks/useRecreationOpsBoard";
import type { OpsAuthorityRow, OpsTeamRisk } from "@/lib/recreation/commandService";
import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import { opsWidgetFillLayout } from "@/lib/dashboard/ops-widget-fill";
import { elasticListRowCap } from "@/lib/dashboard/widget-tier-disclosure";
import type { WidgetHeightTier } from "@/lib/dashboard/workspace-layout";

type RecOpsWidgetProps = {
  layoutContext?: DashboardWidgetRenderContext | null;
};

function Metric({
  label,
  value,
  href,
  warn,
  compact,
}: {
  label: string;
  value: number;
  href: string;
  warn: boolean;
  compact: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-1 flex-col rounded-lg px-2",
        compact ? "py-1" : "py-1.5",
        warn
          ? "bg-[color-mix(in_srgb,var(--ds-warning)_12%,transparent)]"
          : "bg-[color-mix(in_srgb,var(--ds-text-primary)_4%,transparent)]",
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-[color-mix(in_srgb,var(--ds-text-primary)_56%,transparent)]">
        {label}
      </span>
      <span
        className={cn(
          "font-semibold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]",
          compact ? "text-base" : "text-lg",
        )}
      >
        {value}
      </span>
    </Link>
  );
}

function Frame({
  error,
  loading,
  fill,
  children,
}: {
  error: string | null;
  loading: boolean;
  fill: boolean;
  children: ReactNode;
}) {
  if (error) {
    return <p className="px-1 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_56%,transparent)]">{error}</p>;
  }
  if (loading) {
    return <p className="px-1 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_56%,transparent)]">Loading…</p>;
  }
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div
        className={cn(
          "ops-dash-inner-card flex min-h-0 flex-1 flex-col overflow-hidden",
          fill ? "gap-2" : "gap-1.5",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ListLink({
  href,
  title,
  meta,
}: {
  href: string;
  title: string;
  meta?: string;
}) {
  return (
    <Link href={href} className="block rounded-md px-1.5 py-1 hover:bg-[color-mix(in_srgb,var(--ds-text-primary)_5%,transparent)]">
      <span className="line-clamp-2 text-[11px] font-medium text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">
        {title}
      </span>
      {meta ? (
        <span className="text-[10px] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">{meta}</span>
      ) : null}
    </Link>
  );
}

const OPEN_RISK_STATUSES = new Set(["open", "monitoring"]);
const PENDING_AUTHORITY = new Set(["unknown", "need_to_confirm"]);

function prettyLabel(value: string) {
  return value.replace(/_/g, " ");
}

function openRisks(risks: OpsTeamRisk[]) {
  return risks.filter((r) => OPEN_RISK_STATUSES.has(r.status));
}

function pendingAuthority(rows: OpsAuthorityRow[]) {
  return rows.filter((r) => PENDING_AUTHORITY.has(r.status));
}

function recOpsLayout(tier?: WidgetHeightTier) {
  const heightTier = tier ?? "medium";
  return {
    heightTier,
    compact: heightTier === "compact",
    fill: opsWidgetFillLayout(heightTier),
    listCap: elasticListRowCap(heightTier),
    showSecondary: heightTier === "expanded" || heightTier === "tall",
  };
}

export function RecOpsChecklistsWidget({ layoutContext }: RecOpsWidgetProps) {
  const { dash, error, loading } = useRecreationOpsBoard();
  const layout = recOpsLayout(layoutContext?.heightTier);
  const due = (dash?.due_items ?? []).filter((item) => item.kind === "checklist").slice(0, layout.listCap);
  const summaries = (dash?.active_checklist_summaries ?? []).slice(0, layout.listCap);

  return (
    <Frame error={error} loading={loading || !dash} fill={layout.fill}>
      {dash ? (
        <>
          <div className="flex shrink-0 gap-1.5">
            <Metric
              label="Overdue"
              value={dash.checklist_overdue}
              href="/recreation/checklists"
              warn={dash.checklist_overdue > 0}
              compact={layout.compact}
            />
            <Metric
              label="Due today"
              value={dash.checklist_due_today}
              href="/recreation/checklists"
              warn={dash.checklist_due_today > 0}
              compact={layout.compact}
            />
            {!layout.compact ? (
              <Metric
                label="Open"
                value={dash.checklist_open_items}
                href="/recreation/checklists"
                warn={false}
                compact={false}
              />
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {due.length ? (
              <ul className="space-y-1">
                {due.map((item, idx) => (
                  <li key={`${String(item.title)}-${idx}`}>
                    <ListLink
                      href={String(item.href || "/recreation/checklists")}
                      title={String(item.title)}
                      meta={[item.checklist, item.due_date].filter(Boolean).map(String).join(" · ")}
                    />
                  </li>
                ))}
              </ul>
            ) : summaries.length ? (
              <ChecklistProgressList items={summaries} />
            ) : (
              <p className="px-1.5 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                Nothing due on checklists.
              </p>
            )}
            {layout.showSecondary && due.length && summaries.length ? (
              <div className="mt-2">
                <p className="mb-1 px-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ds-accent)]">
                  Active
                </p>
                <ChecklistProgressList items={summaries.slice(0, Math.min(3, layout.listCap))} />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </Frame>
  );
}

function ChecklistProgressList({
  items,
}: {
  items: Array<{ id: string; title: string; progress_pct: number }>;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`/recreation/checklists?id=${c.id}`} className="block px-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex min-w-0 items-center gap-1 truncate font-medium">
                <CheckSquare className="h-3 w-3 shrink-0" aria-hidden />
                {c.title}
              </span>
              <span className="shrink-0 tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                {c.progress_pct}%
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)]">
              <div className="h-full rounded-full bg-[var(--ds-accent)]" style={{ width: `${c.progress_pct}%` }} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RecOpsKnowledgeGapsWidget({ layoutContext }: RecOpsWidgetProps) {
  const { dash, error, loading } = useRecreationOpsBoard();
  const layout = recOpsLayout(layoutContext?.heightTier);
  const gaps = (dash?.open_gaps ?? []).slice(0, layout.listCap);

  return (
    <Frame error={error} loading={loading || !dash} fill={layout.fill}>
      {dash ? (
        <>
          <div className="flex shrink-0 gap-1.5">
            <Metric
              label="Open"
              value={dash.knowledge_gaps_open}
              href="/recreation/knowledge-gaps"
              warn={dash.knowledge_gaps_open > 0}
              compact={layout.compact}
            />
            <Metric
              label="High"
              value={dash.knowledge_gaps_high}
              href="/recreation/knowledge-gaps"
              warn={dash.knowledge_gaps_high > 0}
              compact={layout.compact}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {gaps.length ? (
              <ul className="space-y-1">
                {gaps.map((gap) => (
                  <li key={gap.id}>
                    <ListLink
                      href={`/recreation/knowledge-gaps?id=${gap.id}`}
                      title={gap.question}
                      meta={`${prettyLabel(gap.priority)} · ${prettyLabel(gap.status)}${
                        layout.showSecondary && gap.category ? ` · ${prettyLabel(gap.category)}` : ""
                      }`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1.5 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                No open knowledge gaps.
              </p>
            )}
          </div>
        </>
      ) : null}
    </Frame>
  );
}

export function RecOpsTeamRisksWidget({ layoutContext }: RecOpsWidgetProps) {
  const { dash, risks, error, loading } = useRecreationOpsBoard();
  const layout = recOpsLayout(layoutContext?.heightTier);
  const open = openRisks(risks).slice(0, layout.listCap);
  const count = dash?.open_team_risks ?? openRisks(risks).length;

  return (
    <Frame error={error} loading={loading || !dash} fill={layout.fill}>
      {dash ? (
        <>
          <div className="flex shrink-0 gap-1.5">
            <Metric
              label="Open"
              value={count}
              href="/recreation/team-development"
              warn={count > 0}
              compact={layout.compact}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {open.length ? (
              <ul className="space-y-1">
                {open.map((risk) => (
                  <li key={risk.id}>
                    <ListLink
                      href="/recreation/team-development"
                      title={risk.title}
                      meta={[
                        prettyLabel(risk.severity),
                        prettyLabel(risk.risk_type),
                        layout.showSecondary ? risk.person_name : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1.5 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                No open team risks.
              </p>
            )}
          </div>
        </>
      ) : null}
    </Frame>
  );
}

export function RecOpsAuthorityWidget({ layoutContext }: RecOpsWidgetProps) {
  const { dash, authority, error, loading } = useRecreationOpsBoard();
  const layout = recOpsLayout(layoutContext?.heightTier);
  const pending = pendingAuthority(authority).slice(0, layout.listCap);
  const count = dash?.authority_unknown ?? pendingAuthority(authority).length;

  return (
    <Frame error={error} loading={loading || !dash} fill={layout.fill}>
      {dash ? (
        <>
          <div className="flex shrink-0 gap-1.5">
            <Metric
              label="To confirm"
              value={count}
              href="/recreation/me"
              warn={count > 0}
              compact={layout.compact}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {!dash.profile_complete && !layout.compact ? (
              <Link
                href="/recreation/me"
                className="mb-1 block rounded-md px-1.5 py-1 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_78%,transparent)] hover:bg-[color-mix(in_srgb,var(--ds-text-primary)_5%,transparent)]"
              >
                Operating profile still needs a few fields.
              </Link>
            ) : null}
            {pending.length ? (
              <ul className="space-y-1">
                {pending.map((row) => (
                  <li key={row.id}>
                    <ListLink href="/recreation/me" title={row.decision} meta={prettyLabel(row.status)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1.5 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                Authority is current.
              </p>
            )}
          </div>
        </>
      ) : null}
    </Frame>
  );
}
