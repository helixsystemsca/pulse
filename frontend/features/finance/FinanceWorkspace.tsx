"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  askBudgetAssistant,
  createFinance,
  fetchFinance,
  fetchFinanceDashboard,
  formatMoney,
  formatMoneyExact,
  generateJustification,
  listFinance,
  patchFinance,
} from "@/lib/finance/api";
import { apiFetch, getApiBaseUrl, getTenantApiBearerToken } from "@/lib/api";
import type { BudgetPosition, FinanceDashboard, FinanceLeaf } from "@/lib/finance/leaves";
import { FINANCE_LEAVES, leafFromPath } from "@/lib/finance/leaves";
import { parseClientApiError } from "@/lib/parse-client-api-error";

const GLOSSARY: Record<string, string> = {
  Approved: "Money formally authorized for the fiscal year. ORIGINAL history is never overwritten.",
  Actual: "Posted or paid invoices. Open purchase orders are not actuals.",
  Committed: "Remaining PO balances (encumbered). A PO creates this; an invoice reduces it.",
  Encumbered: "Same as committed — dollars tied up by an issued purchase order.",
  Available: "Approved − Actual − Committed. Not Approved minus Actual alone.",
  Forecast: "Expected further spend this year. A projection, not a posting.",
  Variance: "Approved minus Actual. Available sits beside it so encumbrances stay visible.",
  Operating: "Routine recreation operations: PM, contractors, utilities, chemicals, inspections.",
  Capital: "Major purchases, replacements, upgrades, and projects.",
  Lifecycle: "Age, remaining useful life, maintenance spend, and replacement timing for an existing asset.",
  Deferred: "Needed work that was not funded this year. Carries risk and future budget pressure.",
  "Useful life": "How many years the asset is expected to serve.",
};

function Tip({ term }: { term: keyof typeof GLOSSARY | string }) {
  const text = GLOSSARY[term] ?? "";
  if (!text) return <span>{term}</span>;
  return (
    <span className="inline-flex items-center gap-1">
      {term}
      <button type="button" title={text} className="text-ds-muted hover:text-ds-foreground" aria-label={`What is ${term}?`}>
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </span>
  );
}

function Card({
  label,
  value,
  why,
  origin,
}: {
  label: ReactNode;
  value: string;
  why?: string;
  origin?: string;
}) {
  return (
    <div className="rounded-md border border-ds-border bg-ds-card p-4 shadow-[var(--ds-shadow-card)]">
      <div className="text-xs font-semibold uppercase tracking-wide text-ds-muted">{label}</div>
      <div className="mt-1 font-body text-2xl font-bold text-ds-foreground">{value}</div>
      {origin ? <div className="mt-1 text-[11px] uppercase tracking-wide text-ds-muted">{origin}</div> : null}
      {why ? <p className="mt-2 text-xs leading-relaxed text-ds-muted">{why}</p> : null}
    </div>
  );
}

function PositionGrid({ pos }: { pos: BudgetPosition }) {
  const why = Object.fromEntries(pos.explanations.map((e) => [e.label, e.why]));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card label={<Tip term="Approved" />} value={formatMoney(pos.approved)} why={why.Approved} origin="user input" />
      <Card label={<Tip term="Actual" />} value={formatMoney(pos.actual)} why={why.Actual} origin="system" />
      <Card label={<Tip term="Committed" />} value={formatMoney(pos.committed)} why={why.Committed} origin="system" />
      <Card label={<Tip term="Available" />} value={formatMoney(pos.available)} why={why.Available} origin="system" />
      <Card label={<Tip term="Forecast" />} value={formatMoney(pos.forecast_remaining)} why={why["Forecast remaining"]} origin="forecast" />
      <Card
        label="Projected year-end"
        value={formatMoney(pos.projected_year_end)}
        why={why["Projected year-end balance"]}
        origin="forecast"
      />
    </div>
  );
}

function QuietTable({ headers, rows }: { headers: string[]; rows: (string | number | ReactNode)[][] }) {
  if (!rows.length) {
    return <p className="text-sm text-ds-muted">Nothing recorded yet. Add a row below or wait for Pulse data to land.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-ds-border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-ds-secondary text-ds-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-ds-border">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top text-ds-foreground">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    fn()
      .then(setData)
      .catch((e) => setError(parseClientApiError(e).message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

function CrudList({
  entity,
  fields,
  titleField = "name",
}: {
  entity: string;
  fields: { key: string; label: string; type?: string; required?: boolean }[];
  titleField?: string;
}) {
  const { data, error, loading, reload } = useLoad(() => listFinance(entity), [entity]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const items = (data?.items ?? []) as Record<string, unknown>[];

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      for (const f of fields) {
        const v = draft[f.key];
        if (v === undefined || v === "") continue;
        body[f.key] = f.type === "number" ? Number(v) : f.type === "checkbox" ? v === "true" : v;
      }
      await createFinance(entity, body);
      setDraft({});
      reload();
    } catch (err) {
      alert(parseClientApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function onPatch(id: string, body: Record<string, unknown>) {
    try {
      await patchFinance(entity, id, body);
      reload();
    } catch (err) {
      alert(parseClientApiError(err).message);
    }
  }

  return (
    <div className="space-y-4">
      {loading ? <p className="text-sm text-ds-muted">Loading…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <QuietTable
        headers={[titleField, ...fields.filter((f) => f.key !== titleField).map((f) => f.label), ""]}
        rows={items.map((row) => [
          String(row[titleField] ?? row.title ?? "—"),
          ...fields.filter((f) => f.key !== titleField).map((f) => {
            const v = row[f.key];
            if (f.type === "number") return formatMoney(Number(v || 0));
            return v == null || v === "" ? "—" : String(v);
          }),
          row.id && fields.some((f) => f.key === "status") ? (
            <select
              className="rounded border border-ds-border bg-white px-2 py-1 text-xs"
              value={String(row.status ?? "")}
              onChange={(e) => onPatch(String(row.id), { status: e.target.value })}
            >
              {["draft", "issued", "partial", "closed", "cancelled", "posted", "paid", "void", "active", "open", "accepted"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            ""
          ),
        ])}
      />
      <form onSubmit={onCreate} className="grid gap-2 rounded-md border border-ds-border bg-ds-card p-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <label key={f.key} className="text-xs font-medium text-ds-muted">
            {f.label}
            {f.type === "checkbox" ? (
              <input
                type="checkbox"
                className="ml-2"
                checked={draft[f.key] === "true"}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.checked ? "true" : "false" }))}
              />
            ) : (
              <input
                required={f.required}
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                step={f.type === "number" ? "0.01" : undefined}
                className="mt-1 w-full rounded border border-ds-border px-2 py-1.5 text-sm text-ds-foreground"
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            )}
          </label>
        ))}
        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}

function MonthlyBars({ rows }: { rows: { month: string; actual: number }[] }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.actual), 1);
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-ds-foreground">Monthly actuals</h2>
      <div className="grid grid-cols-12 gap-1 rounded-md border border-ds-border bg-ds-card p-3">
        {rows.map((r) => (
          <div key={r.month} className="flex flex-col items-center gap-1" title={`${r.month}: ${formatMoney(r.actual)}`}>
            <div className="flex h-16 w-full items-end">
              <div
                className="w-full rounded-sm bg-ds-primary"
                style={{ height: `${Math.max(4, (r.actual / max) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-ds-muted">{r.month.slice(5)}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-ds-muted">Posted invoices by month. Open POs are not shown here.</p>
    </div>
  );
}

function Hub({ dash }: { dash: FinanceDashboard | null }) {
  const links = Object.values(FINANCE_LEAVES);
  return (
    <div className="space-y-6">
      {dash ? <PositionGrid pos={dash.combined} /> : null}
      <p className="text-sm leading-relaxed text-ds-muted">
        Line of sight: asset → condition → maintenance → replacement → project → procurement → budget →
        actual → forecast → next year’s plan. Pulse reuses Equipment, PM, Work Requests, and Projects — it
        does not duplicate the asset master.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.slug}
            href={`/finance/${l.slug}`}
            className="rounded-md border border-ds-border bg-ds-card px-3 py-3 text-sm hover:bg-ds-secondary"
          >
            <div className="font-semibold text-ds-foreground">{l.title}</div>
            <div className="mt-1 text-xs text-ds-muted">{l.purpose}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function BudgetLinesEditor() {
  const { data, loading, error, reload } = useLoad(() => fetchFinance("planner/current"), []);
  const lines = ((data?.lines as Record<string, unknown>[]) ?? []) as Record<string, unknown>[];
  return (
    <div className="space-y-3">
      {loading ? <p className="text-sm text-ds-muted">Loading…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <QuietTable
        headers={["Line", "Approved", "Actual", "Committed", "Available", "Forecast", "% spent"]}
        rows={lines.map((line) => {
          const pos = (line.position || {}) as BudgetPosition;
          return [
            String(line.name ?? ""),
            <input
              key="a"
              className="w-28 rounded border border-ds-border px-2 py-1 text-sm"
              defaultValue={String(line.approved_amount ?? 0)}
              onBlur={(e) => {
                const id = String(line.id);
                void patchFinance("budget-lines", id, { approved_amount: Number(e.target.value) }).then(reload);
              }}
            />,
            formatMoney(pos.actual),
            formatMoney(pos.committed),
            formatMoney(pos.available),
            formatMoney(pos.forecast_remaining),
            `${pos.percent_spent ?? 0}%`,
          ];
        })}
      />
      <p className="text-xs text-ds-muted">
        Changing approved writes a REVISED history row. ORIGINAL is never overwritten.
      </p>
    </div>
  );
}

export function FinanceWorkspace({ slug }: { slug?: string[] }) {
  const leaf: FinanceLeaf = useMemo(() => leafFromPath(slug), [slug]);
  const { data: dash, error, loading, reload } = useLoad(() => fetchFinanceDashboard(), []);
  const path = slug?.join("/") ?? "";

  return (
    <PageBody>
      <PageHeader icon={BarChart2} title={leaf.title} description={leaf.purpose} />
      {loading ? <p className="text-sm text-ds-muted">Loading budget figures…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!path ? <Hub dash={dash} /> : null}

      {path === "dashboard" && dash ? (
        <div className="space-y-6">
          <p className="text-sm text-ds-muted">
            Fiscal {dash.fiscal_year.year} ({dash.fiscal_year.starts_on} – {dash.fiscal_year.ends_on}).{" "}
            {dash.combined.formula}. Year-over-year actuals {formatMoney(dash.yoy_actual.delta)} (
            {dash.yoy_actual.percent ?? "—"}%).
          </p>
          <h2 className="text-sm font-semibold text-ds-foreground">Combined</h2>
          <PositionGrid pos={dash.combined} />
          <h2 className="text-sm font-semibold text-ds-foreground">Operating</h2>
          <PositionGrid pos={dash.operating} />
          <h2 className="text-sm font-semibold text-ds-foreground">Capital</h2>
          <PositionGrid pos={dash.capital} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Deferred items" value={String(dash.deferred_maintenance.count)} why="Open deferred-maintenance register." origin="system" />
            <Card label="Deferred cost" value={formatMoney(dash.deferred_maintenance.cost)} origin="user input" />
            <Card label="Replacements this year" value={formatMoney(dash.upcoming_replacements.this_year_cost)} origin="forecast" />
            <Card label="PM 90-day forecast" value={formatMoney(dash.service_forecast.d90)} origin="forecast" />
            <Card label="% spent" value={`${dash.combined.percent_spent}%`} origin="system" why="Actual ÷ approved." />
            <Card label="% committed" value={`${dash.combined.percent_committed}%`} origin="system" why="Remaining PO ÷ approved." />
          </div>
          <MonthlyBars rows={dash.monthly_actuals || []} />
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ds-foreground">Upcoming expenditures (90 days)</h2>
              <QuietTable
                headers={["Horizon", "Asset", "Service", "Due", "Cost", "Budget"]}
                rows={(dash.upcoming_expenditures || []).map((r) => [
                  r.horizon,
                  r.asset ?? "—",
                  r.service ?? "—",
                  r.due ?? "—",
                  formatMoney(r.cost),
                  r.budget_status ?? "—",
                ])}
              />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ds-foreground">Upcoming capital</h2>
              <QuietTable
                headers={["Kind", "Name", "Year", "Amount", "Origin"]}
                rows={(dash.upcoming_capital || []).map((r) => [
                  r.kind,
                  r.name,
                  r.year,
                  formatMoney(r.amount),
                  r.origin,
                ])}
              />
            </div>
          </div>
          {dash.alerts.length ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-ds-foreground">Alerts</h2>
              {dash.alerts.map((a) => (
                <Link key={a.kind + a.title} href={a.href} className="flex gap-2 rounded-md border border-ds-border px-3 py-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-semibold">{a.title}.</span> {a.why}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {path.startsWith("operating/") && dash ? (
        <OperatingViews path={path} dash={dash} />
      ) : null}
      {path.startsWith("capital/") ? <CapitalViews path={path} /> : null}
      {path.startsWith("lifecycle/") ? <LifecycleViews path={path} /> : null}
      {path === "planner/current" ? <BudgetLinesEditor /> : null}
      {path === "planner/next-year" ? <JsonView path="planner/next-year" moneyKeys={["amount", "suggested_total"]} /> : null}
      {path === "planner/long-range" ? <JsonView path="planner/long-range" /> : null}
      {path.startsWith("scenarios/") ? <ScenarioViews path={path} /> : null}
      {path === "procurement/quotes" ? (
        <CrudList
          entity="quotes"
          titleField="title"
          fields={[
            { key: "title", label: "Title", required: true },
            { key: "vendor_name", label: "Vendor" },
            { key: "amount", label: "Amount", type: "number" },
            { key: "status", label: "Status" },
          ]}
        />
      ) : null}
      {path === "procurement/pos" ? <PoView /> : null}
      {path === "procurement/invoices" ? <InvoiceView /> : null}
      {path === "procurement/contracts" ? (
        <CrudList
          entity="contracts"
          titleField="title"
          fields={[
            { key: "title", label: "Title", required: true },
            { key: "vendor_name", label: "Vendor" },
            { key: "annual_cost", label: "Annual cost", type: "number" },
            { key: "renewal_on", label: "Renewal", type: "date" },
            { key: "status", label: "Status" },
          ]}
        />
      ) : null}
      {path === "deferred" ? (
        <div className="space-y-6">
          <CrudList
            entity="deferred"
            titleField="title"
            fields={[
              { key: "title", label: "Title", required: true },
              { key: "estimated_cost", label: "Estimated cost", type: "number" },
              { key: "risk", label: "Risk (low/medium/high/critical)" },
              { key: "work_request_id", label: "Work request id" },
              { key: "regulatory", label: "Regulatory", type: "checkbox" },
              { key: "safety", label: "Safety", type: "checkbox" },
              { key: "notes", label: "Notes" },
            ]}
          />
          <DeferredBacklog />
        </div>
      ) : null}
      {path === "funding" ? (
        <div className="space-y-8">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ds-foreground">Funding sources</h2>
            <CrudList
              entity="funding-sources"
              titleField="name"
              fields={[
                { key: "name", label: "Name", required: true },
                { key: "kind", label: "Kind (taxation/reserve/grant)" },
                { key: "amount_available", label: "Amount available", type: "number" },
                { key: "notes", label: "Notes" },
              ]}
            />
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ds-foreground">Cost centres</h2>
            <p className="text-xs text-ds-muted">Admin-configurable. Assign them on budget lines.</p>
            <CrudList
              entity="cost-centres"
              titleField="name"
              fields={[
                { key: "code", label: "Code", required: true },
                { key: "name", label: "Name", required: true },
                { key: "department", label: "Department" },
                { key: "gl_account", label: "GL / account" },
              ]}
            />
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ds-foreground">Expense categories</h2>
            <CrudList
              entity="categories"
              titleField="name"
              fields={[
                { key: "code", label: "Code", required: true },
                { key: "name", label: "Name", required: true },
                { key: "kind", label: "Kind (operating/capital)" },
              ]}
            />
          </section>
        </div>
      ) : null}
      {path === "assistant" ? <AssistantView /> : null}
      {path === "opportunities" ? <JsonView path="opportunities" /> : null}
      {path === "history" ? <HistoryView /> : null}
      {path === "assumptions" ? <AssumptionsView onSaved={reload} /> : null}
      {path === "justifications" ? <JustificationsView /> : null}
      {path === "alerts" && dash ? (
        <div className="space-y-2">
          {dash.alerts.length === 0 ? <p className="text-sm text-ds-muted">No alerts right now.</p> : null}
          {dash.alerts.map((a) => (
            <Link key={a.kind + a.title} href={a.href} className="block rounded-md border border-ds-border px-3 py-2 text-sm">
              <span className="font-semibold">{a.title}.</span> {a.why}
            </Link>
          ))}
        </div>
      ) : null}
      {path === "reports" ? <ReportsView dash={dash} /> : null}

      <details className="mt-8 rounded-md border border-ds-border bg-ds-card p-3 text-sm">
        <summary className="cursor-pointer font-semibold">
          <BookOpen className="mr-2 inline h-4 w-4" />
          What do these words mean?
        </summary>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.entries(GLOSSARY).map(([k, v]) => (
            <div key={k}>
              <dt className="font-semibold text-ds-foreground">{k}</dt>
              <dd className="text-ds-muted">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ds-muted">
          SYSTEM DATA · USER INPUT · FORECAST · AI RECOMMENDATION — AI never purchases, approves, or
          creates a commitment without an explicit click from you.
        </p>
      </details>
    </PageBody>
  );
}

function OperatingViews({ path, dash }: { path: string; dash: FinanceDashboard }) {
  const view = path.split("/")[1] || "actuals";
  const { data, loading, error } = useLoad(() => fetchFinance(`operating/${view}`), [view]);
  const lines = ((data?.lines as Record<string, unknown>[]) ?? []) as Record<string, unknown>[];
  const invoices = ((data?.invoices as Record<string, unknown>[]) ?? []) as Record<string, unknown>[];
  const commitments = ((data?.commitments as Record<string, unknown>[]) ?? []) as Record<string, unknown>[];
  return (
    <div className="space-y-4">
      <PositionGrid pos={dash.operating} />
      {loading ? <p className="text-sm text-ds-muted">Loading…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <p className="text-sm text-ds-muted">{String(data?.why ?? "")}</p>
      {data?.yoy_actual ? (
        <p className="text-sm text-ds-muted">
          Year-over-year actuals {formatMoney(Number((data.yoy_actual as { delta?: number }).delta || 0))} (
          {(data.yoy_actual as { percent?: number | null }).percent ?? "—"}%).
        </p>
      ) : null}
      <MonthlyBars
        rows={((data?.monthly as { month: string; actual: number }[]) || dash.monthly_actuals || []) as { month: string; actual: number }[]}
      />
      <QuietTable
        headers={["Category", "Approved", "Actual", "Committed", "Available", "Overrun"]}
        rows={lines.map((l) => {
          const pos = (l.position || {}) as BudgetPosition;
          return [
            String(l.name ?? ""),
            formatMoney(pos.approved),
            formatMoney(pos.actual),
            formatMoney(pos.committed),
            formatMoney(pos.available),
            pos.available < 0 ? "Yes" : "No",
          ];
        })}
      />
      {view === "actuals" ? (
        <QuietTable
          headers={["Invoice", "Vendor", "Amount", "Status", "Date"]}
          rows={invoices.map((i) => [
            String(i.number ?? i.id),
            String(i.vendor_name ?? "—"),
            formatMoney(Number(i.amount || 0)),
            String(i.status ?? ""),
            String(i.invoice_date ?? i.posted_at ?? "—"),
          ])}
        />
      ) : null}
      {view === "commitments" ? (
        <QuietTable
          headers={["PO", "Vendor", "Amount", "Remaining", "Status"]}
          rows={commitments.map((i) => [
            String(i.number ?? ""),
            String(i.vendor_name ?? "—"),
            formatMoney(Number(i.amount || 0)),
            formatMoney(Number(i.remaining_commitment || 0)),
            String(i.status ?? ""),
          ])}
        />
      ) : null}
    </div>
  );
}

function CapitalViews({ path }: { path: string }) {
  const view = path.split("/")[1] || "projects";
  const { data, loading, error } = useLoad(() => fetchFinance(`capital/${view}`), [view]);
  const items = ((data?.items as Record<string, unknown>[]) ?? []) as Record<string, unknown>[];
  return (
    <div className="space-y-4">
      {loading ? <p className="text-sm text-ds-muted">Loading…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <QuietTable
        headers={["Name", "Asset / project", "Funding", "Approved", "Actual", "Committed", "Available", "Years"]}
        rows={items.map((i) => {
          const pos = (i.position || {}) as BudgetPosition;
          return [
            String(i.name ?? ""),
            [i.asset_name, i.project_name].filter(Boolean).join(" · ") || "—",
            String(i.funding_source_name ?? "—"),
            formatMoney(pos.approved),
            formatMoney(pos.actual),
            formatMoney(pos.committed),
            formatMoney(pos.available),
            `${i.start_year ?? "—"}–${i.end_year ?? "—"}`,
          ];
        })}
      />
      <CrudList
        entity="capital-items"
        titleField="name"
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "kind", label: "Kind (project/purchase/replacement)" },
          { key: "estimated_cost", label: "Estimated", type: "number" },
          { key: "approved_amount", label: "Approved", type: "number" },
          { key: "start_year", label: "Start year", type: "number" },
          { key: "end_year", label: "End year", type: "number" },
          { key: "priority", label: "Priority" },
          { key: "justification", label: "Justification" },
          { key: "equipment_id", label: "Equipment id" },
          { key: "project_id", label: "Pulse project id" },
          { key: "funding_source_id", label: "Funding source id" },
          { key: "pm_impact", label: "PM impact" },
        ]}
      />
    </div>
  );
}

function LifecycleViews({ path }: { path: string }) {
  const endpoint =
    path === "lifecycle/service" ? "lifecycle/service" : path === "lifecycle/cost" ? "lifecycle/cost" : "lifecycle/replacement";
  const { data, loading, error } = useLoad(() => fetchFinance(endpoint), [endpoint]);
  const [horizon, setHorizon] = useState("5");
  if (loading) return <p className="text-sm text-ds-muted">Loading…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (endpoint === "lifecycle/service") {
    const windows = (data?.windows || {}) as Record<string, Record<string, unknown>[]>;
    return (
      <div className="space-y-4">
        <p className="text-sm text-ds-muted">{String(data?.why ?? "")}</p>
        {Object.entries(windows).map(([k, rows]) => (
          <div key={k}>
            <h3 className="mb-2 text-sm font-semibold capitalize">{k}</h3>
            <QuietTable
              headers={["Asset", "Service", "Due", "Cost", "Budget status"]}
              rows={(rows || []).map((r) => [
                String(r.asset ?? "—"),
                String(r.service ?? ""),
                String(r.due ?? ""),
                formatMoney(Number(r.cost || 0)),
                String(r.budget_status ?? ""),
              ])}
            />
          </div>
        ))}
      </div>
    );
  }
  const items = ((data?.items as Record<string, unknown>[]) ?? []) as Record<string, unknown>[];
  const views = (data?.views || {}) as Record<string, Record<string, { count: number; cost: number }>>;
  const cutoff = Number(horizon);
  const yearNow = new Date().getFullYear();
  const filtered = items.filter((i) => {
    const yr = Number(i.planned_replacement_year || 0);
    return !yr || yr <= yearNow + cutoff;
  });
  return (
    <div className="space-y-3">
      <p className="text-sm text-ds-muted">{String(data?.why ?? "")}</p>
      <div className="flex flex-wrap gap-2">
        {["1", "2", "3", "5", "10"].map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHorizon(h)}
            className={`rounded-md border px-2 py-1 text-xs ${horizon === h ? "border-ds-primary bg-ds-secondary font-semibold" : "border-ds-border"}`}
          >
            {h}-year
            {views[h] ? ` · ${formatMoney(Object.values(views[h]).reduce((s, v) => s + (v.cost || 0), 0))}` : ""}
          </button>
        ))}
      </div>
      <QuietTable
        headers={["Asset", "Age", "RUL", "Replace year", "Cost now", "Cost at year", "Lifecycle to date", "Next service", "Criticality"]}
        rows={filtered.map((i) => [
          String(i.name ?? ""),
          i.age_years ?? "—",
          i.remaining_useful_life_years ?? "—",
          String(i.planned_replacement_year ?? "—"),
          formatMoney(Number(i.replacement_cost_now || 0)),
          formatMoney(Number(i.replacement_cost_at_year || 0)),
          formatMoney(Number(i.lifecycle_cost_to_date || 0)),
          String((i.next_service as { name?: string; due?: string } | undefined)?.due ?? "—"),
          String(i.criticality ?? "—"),
        ])}
      />
      <AssetProfileForm />
    </div>
  );
}

function AssetProfileForm() {
  const { data: equipment } = useLoad(
    () => apiFetch<{ id: string; name: string }[]>("/api/v1/equipment"),
    [],
  );
  const [equipmentId, setEquipmentId] = useState("");
  const [life, setLife] = useState("15");
  const [cost, setCost] = useState("");
  const [repl, setRepl] = useState("");
  const [acquired, setAcquired] = useState("");
  const [condition, setCondition] = useState("fair");
  const [criticality, setCriticality] = useState("medium");
  const rows = Array.isArray(equipment) ? equipment : [];
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await createFinance("asset-profiles", {
        equipment_id: equipmentId,
        useful_life_years: Number(life),
        acquisition_cost: cost ? Number(cost) : null,
        replacement_value: repl ? Number(repl) : null,
        acquisition_date: acquired || null,
        condition,
        criticality,
      });
      alert("Saved. Forecasts recalculate from useful life and assumptions.");
    } catch (err) {
      alert(parseClientApiError(err).message);
    }
  }
  return (
    <form onSubmit={save} className="grid gap-2 rounded-md border border-ds-border p-3 sm:grid-cols-4">
      <label className="text-xs font-medium text-ds-muted sm:col-span-2">
        Existing asset (Equipment registry)
        <select
          required
          className="mt-1 w-full rounded border border-ds-border px-2 py-1.5 text-sm text-ds-foreground"
          value={equipmentId}
          onChange={(e) => setEquipmentId(e.target.value)}
        >
          <option value="">Select equipment…</option>
          {rows.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.name}
            </option>
          ))}
        </select>
      </label>
      <input placeholder="Useful life (years)" className="rounded border border-ds-border px-2 py-1.5 text-sm" value={life} onChange={(e) => setLife(e.target.value)} />
      <input placeholder="Acquisition cost" className="rounded border border-ds-border px-2 py-1.5 text-sm" value={cost} onChange={(e) => setCost(e.target.value)} />
      <input placeholder="Replacement value" className="rounded border border-ds-border px-2 py-1.5 text-sm" value={repl} onChange={(e) => setRepl(e.target.value)} />
      <input type="date" className="rounded border border-ds-border px-2 py-1.5 text-sm" value={acquired} onChange={(e) => setAcquired(e.target.value)} />
      <input placeholder="Condition" className="rounded border border-ds-border px-2 py-1.5 text-sm" value={condition} onChange={(e) => setCondition(e.target.value)} />
      <input placeholder="Criticality" className="rounded border border-ds-border px-2 py-1.5 text-sm" value={criticality} onChange={(e) => setCriticality(e.target.value)} />
      <button type="submit" className="rounded-md bg-ds-primary px-3 py-2 text-sm font-semibold text-white sm:col-span-4">
        Save asset financial profile
      </button>
    </form>
  );
}

function ScenarioViews({ path }: { path: string }) {
  const kind =
    path.endsWith("repair") ? "repair_defer" : path.endsWith("defer") ? "do_nothing" : path.endsWith("compare") ? "" : "replace_now";
  if (!kind) {
    return <JsonView path="scenarios/compare" />;
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-ds-muted">
        Consequences only. Pulse will not choose replace, repair, or defer. Add a scenario, then an option.
      </p>
      <CrudList
        entity="scenarios"
        titleField="name"
        fields={[
          { key: "name", label: "Scenario name", required: true },
          { key: "notes", label: "Notes" },
        ]}
      />
      <CrudList
        entity="scenario-options"
        titleField="option_kind"
        fields={[
          { key: "scenario_id", label: "Scenario id", required: true },
          { key: "option_kind", label: "Option kind" },
          { key: "estimated_cost", label: "Replacement cost now", type: "number" },
          { key: "risk_note", label: "Risk note" },
        ]}
      />
      <p className="text-xs text-ds-muted">Suggested option_kind: {kind} (or replace_next_year / replace_3_years).</p>
    </div>
  );
}

function PoView() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ds-muted">
        Status <strong>issued</strong> creates the commitment. Status <strong>cancelled</strong> releases it.
        Invoices posted against the PO reduce remaining commitment and increase actual.
      </p>
      <CrudList
        entity="purchase-orders"
        titleField="number"
        fields={[
          { key: "number", label: "Number" },
          { key: "vendor_name", label: "Vendor" },
          { key: "amount", label: "Amount", type: "number", required: true },
          { key: "status", label: "Status (draft/issued)" },
        ]}
      />
    </div>
  );
}

function InvoiceView() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ds-muted">
        Set status to <strong>posted</strong> (or <strong>paid</strong>) to increase actual. Include po_id to
        reduce the remaining commitment on that PO.
      </p>
      <CrudList
        entity="invoices"
        titleField="number"
        fields={[
          { key: "number", label: "Number" },
          { key: "vendor_name", label: "Vendor" },
          { key: "amount", label: "Amount", type: "number", required: true },
          { key: "po_id", label: "PO id" },
          { key: "status", label: "Status (draft/posted/paid)" },
          { key: "invoice_date", label: "Invoice date", type: "date" },
        ]}
      />
    </div>
  );
}

function DeferredBacklog() {
  const { data, loading, error } = useLoad(() => fetchFinance("deferred/register"), []);
  const backlog = ((data?.work_request_backlog as Record<string, unknown>[] | undefined) ?? []) as Record<
    string,
    unknown
  >[];
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-ds-foreground">Open work requests (not yet costed)</h2>
      {loading ? <p className="text-sm text-ds-muted">Loading…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <QuietTable
        headers={["Work request", "Status", "Priority", "Already in register"]}
        rows={backlog.map((r) => [
          String(r.title ?? r.id),
          String(r.status ?? ""),
          String(r.priority ?? "—"),
          r.in_register ? "Yes" : "No",
        ])}
      />
      <p className="text-xs text-ds-muted">
        Promote a work request into a costed deferred item (set work_request_id) instead of duplicating the asset.
      </p>
    </div>
  );
}

function AssistantView() {
  const [q, setQ] = useState("Why is available not approved minus actual?");
  const [answer, setAnswer] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  async function onAsk(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setAnswer(await askBudgetAssistant(q));
    } catch (err) {
      alert(parseClientApiError(err).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <form onSubmit={onAsk} className="flex gap-2">
        <input className="flex-1 rounded border border-ds-border px-3 py-2 text-sm" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" disabled={busy} className="rounded-md bg-ds-primary px-3 py-2 text-sm font-semibold text-white">
          {busy ? "…" : "Ask"}
        </button>
      </form>
      {answer ? (
        <div className="rounded-md border border-ds-border bg-ds-card p-4 text-sm">
          <p className="leading-relaxed">{String(answer.answer)}</p>
          <p className="mt-2 text-xs text-ds-muted">{String(answer.disclaimer)}</p>
          {Array.isArray(answer.citations) ? (
            <ul className="mt-3 list-disc pl-5 text-xs text-ds-muted">
              {(answer.citations as { title?: string; href?: string; detail?: string }[]).map((c) => (
                <li key={String(c.href) + String(c.title)}>
                  <Link href={String(c.href || "/finance/dashboard")} className="underline">
                    {String(c.title)}
                  </Link>
                  {c.detail ? ` — ${c.detail}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {answer.numbers ? (
            <pre className="mt-3 overflow-auto rounded border border-ds-border bg-ds-secondary p-2 text-[11px]">
              {JSON.stringify(answer.numbers, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function JsonView({ path, moneyKeys }: { path: string; moneyKeys?: string[] }) {
  const { data, loading, error } = useLoad(() => fetchFinance(path), [path]);
  if (loading) return <p className="text-sm text-ds-muted">Loading…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  const recs = (data?.candidates as Record<string, unknown>[] | undefined) || (data?.recommendations as Record<string, unknown>[] | undefined) || (data?.rows as Record<string, unknown>[] | undefined);
  if (recs) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ds-muted">{String(data?.why ?? "")}</p>
        <QuietTable
          headers={["Item", "Amount", "Origin", "Why"]}
          rows={recs.map((r) => [
            String(r.label ?? r.title ?? r.asset ?? r.option_kind ?? "—"),
            formatMoney(Number(r.amount ?? r.estimated_cost ?? 0)),
            String(r.origin ?? "—"),
            String(r.why ?? r.risk_note ?? ""),
          ])}
        />
        {data && "suggested_total" in data ? <p className="text-sm">Suggested total {formatMoney(Number(data.suggested_total))}</p> : null}
        {data && "available" in data ? <p className="text-sm">Uncommitted available {formatMoney(Number(data.available))}</p> : null}
      </div>
    );
  }
  if (data && "matrix" in data) {
    const matrix = data.matrix as Record<string, { total: number; replacements: number; capital_items: number }>;
    return (
      <div className="space-y-3">
        <p className="text-sm text-ds-muted">
          Peak year {String(data.peak_year)} at {formatMoney(Number(data.peak_amount))}. {String(data.why ?? "")}
        </p>
        <QuietTable
          headers={["Year", "Replacements", "Capital items", "Total"]}
          rows={Object.entries(matrix).map(([y, v]) => [y, formatMoney(v.replacements), formatMoney(v.capital_items), formatMoney(v.total)])}
        />
        {Array.isArray(data.gaps) && (data.gaps as { year: string; required: number; funding_named: number; gap: number }[]).length ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Funding gaps</h3>
            <QuietTable
              headers={["Year", "Required", "Named funding", "Gap"]}
              rows={(data.gaps as { year: string; required: number; funding_named: number; gap: number }[]).map((g) => [
                g.year,
                formatMoney(g.required),
                formatMoney(g.funding_named),
                formatMoney(g.gap),
              ])}
            />
          </div>
        ) : null}
      </div>
    );
  }
  void moneyKeys;
  return <pre className="overflow-auto rounded-md border border-ds-border bg-ds-card p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>;
}

function HistoryView() {
  const { data, loading, error } = useLoad(() => listFinance("history"), []);
  const items = data?.items ?? [];
  if (loading) return <p className="text-sm text-ds-muted">Loading…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  return (
    <QuietTable
      headers={["When", "Kind", "Approved", "Actual", "Committed", "Available", "Note"]}
      rows={items.map((i) => [
        String(i.created_at ?? ""),
        String(i.version_kind ?? ""),
        formatMoney(Number(i.approved_total ?? (i.snapshot as { approved?: number } | undefined)?.approved || 0)),
        formatMoney(Number(i.actual_total ?? (i.snapshot as { actual?: number } | undefined)?.actual || 0)),
        formatMoney(Number(i.committed_total ?? (i.snapshot as { committed?: number } | undefined)?.committed || 0)),
        formatMoney(Number(i.available_total ?? (i.snapshot as { available?: number } | undefined)?.available || 0)),
        String(i.note ?? ""),
      ])}
    />
  );
}

function AssumptionsView({ onSaved }: { onSaved: () => void }) {
  const { data } = useLoad(() => listFinance("assumptions"), []);
  const row = data?.items?.[0] as Record<string, unknown> | undefined;
  const [inf, setInf] = useState("");
  const [con, setCon] = useState("");
  const [source, setSource] = useState("");
  useEffect(() => {
    if (!row) return;
    setInf(String(row.inflation_rate ?? "0.03"));
    setCon(String(row.contingency_rate ?? "0.10"));
    setSource(String(row.source ?? ""));
  }, [row]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!row?.id) return;
    await patchFinance("assumptions", String(row.id), {
      inflation_rate: Number(inf),
      contingency_rate: Number(con),
      source,
    });
    onSaved();
  }
  return (
    <form onSubmit={save} className="grid max-w-xl gap-3">
      <label className="text-sm">
        Inflation rate (e.g. 0.03)
        <input className="mt-1 w-full rounded border border-ds-border px-2 py-1.5" value={inf} onChange={(e) => setInf(e.target.value)} />
      </label>
      <label className="text-sm">
        Contingency rate (e.g. 0.10)
        <input className="mt-1 w-full rounded border border-ds-border px-2 py-1.5" value={con} onChange={(e) => setCon(e.target.value)} />
      </label>
      <label className="text-sm">
        Source
        <input className="mt-1 w-full rounded border border-ds-border px-2 py-1.5" value={source} onChange={(e) => setSource(e.target.value)} />
      </label>
      <button type="submit" className="w-fit rounded-md bg-ds-primary px-3 py-2 text-sm font-semibold text-white">
        Recalculate forecasts
      </button>
    </form>
  );
}

function JustificationsView() {
  const { data, reload } = useLoad(() => listFinance("justifications"), []);
  const [title, setTitle] = useState("");
  const [need, setNeed] = useState("");
  const [risk, setRisk] = useState("");
  const [amount, setAmount] = useState("");
  async function gen(e: FormEvent) {
    e.preventDefault();
    try {
      await generateJustification({ title, need, risk, amount: Number(amount || 0) });
      reload();
    } catch (err) {
      alert(parseClientApiError(err).message);
    }
  }
  const items = data?.items ?? [];
  return (
    <div className="space-y-4">
      <form onSubmit={gen} className="grid gap-2">
        <input placeholder="Title" className="rounded border border-ds-border px-2 py-1.5 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder="Need" className="rounded border border-ds-border px-2 py-1.5 text-sm" value={need} onChange={(e) => setNeed(e.target.value)} />
        <textarea placeholder="Risk of deferral" className="rounded border border-ds-border px-2 py-1.5 text-sm" value={risk} onChange={(e) => setRisk(e.target.value)} />
        <input placeholder="Amount" className="rounded border border-ds-border px-2 py-1.5 text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button type="submit" className="w-fit rounded-md bg-ds-primary px-3 py-2 text-sm font-semibold text-white">
          Generate (does not approve)
        </button>
      </form>
      {items.map((i) => (
        <pre key={String(i.id)} className="whitespace-pre-wrap rounded-md border border-ds-border p-3 text-xs">
          {String(i.generated_text ?? "")}
        </pre>
      ))}
    </div>
  );
}

function ReportsView({ dash }: { dash: FinanceDashboard | null }) {
  async function download() {
    const base = getApiBaseUrl();
    const token = getTenantApiBearerToken();
    const res = await fetch(`${base}/api/v1/finance/reports.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finance-budget.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-3">
      {dash ? <p className="text-sm">Combined available {formatMoneyExact(dash.combined.available)}.</p> : null}
      <button type="button" onClick={() => void download()} className="rounded-md bg-ds-primary px-3 py-2 text-sm font-semibold text-white">
        Download CSV
      </button>
    </div>
  );
}
