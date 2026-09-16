export type MoneyOrigin = "system" | "user_input" | "forecast" | "ai_recommendation";

export type BudgetPosition = {
  kind: string;
  label: string;
  approved: number;
  actual: number;
  committed: number;
  available: number;
  forecast_remaining: number;
  projected_year_end: number;
  variance_to_actual: number;
  percent_spent: number;
  percent_committed: number;
  percent_available: number;
  formula: string;
  explanations: { amount: number; origin: MoneyOrigin; label: string; why: string }[];
};

export type FinanceDashboard = {
  fiscal_year: { year: number; starts_on: string; ends_on: string; status: string };
  assumptions: Record<string, unknown>;
  operating: BudgetPosition;
  capital: BudgetPosition;
  combined: BudgetPosition;
  yoy_actual: { current: number; prior: number; delta: number; percent: number | null; why: string };
  deferred_maintenance: { count: number; cost: number };
  upcoming_replacements: { this_year_cost: number; count: number };
  upcoming_expenditures: {
    asset?: string | null;
    service?: string;
    due?: string;
    cost: number;
    horizon: string;
    budget_status?: string;
  }[];
  upcoming_capital: { kind: string; name: string; year: number; amount: number; origin: string; why: string }[];
  monthly_actuals: { month: string; actual: number; origin: string; why: string }[];
  service_forecast: { year_forecast: number; d30: number; d90: number; missing_cost_count: number };
  contracts_annual: number;
  alerts: { kind: string; severity: string; title: string; why: string; href: string }[];
  glossary: { term: string; definition: string }[];
  origins: { origin: string; meaning: string }[];
  ai_guard: { allowed: boolean; why: string };
};

export type FinanceLeaf = {
  slug: string;
  title: string;
  purpose: string;
};

export const FINANCE_LEAVES: Record<string, FinanceLeaf> = {
  dashboard: {
    slug: "dashboard",
    title: "Budget Dashboard",
    purpose: "Fiscal-year approved, actual, committed, available, forecast, and variance — with the formula shown, not hidden.",
  },
  "operating/actuals": {
    slug: "operating/actuals",
    title: "Operating · Actuals",
    purpose: "Posted invoices against the operating envelope. Open POs are commitments, not actuals.",
  },
  "operating/commitments": {
    slug: "operating/commitments",
    title: "Operating · Commitments",
    purpose: "Remaining purchase-order balances (encumbrances).",
  },
  "operating/forecast": {
    slug: "operating/forecast",
    title: "Operating · Forecast",
    purpose: "Expected further operating spend from PM, contracts, and planner lines.",
  },
  "operating/variance": {
    slug: "operating/variance",
    title: "Operating · Variance",
    purpose: "Approved versus actual, with available (approved − actual − committed) beside it.",
  },
  "capital/projects": {
    slug: "capital/projects",
    title: "Capital · Projects",
    purpose: "Budget-oriented capital projects linked to Pulse assets and (optionally) a project record. Not a second PM tool.",
  },
  "capital/purchases": {
    slug: "capital/purchases",
    title: "Capital · Purchases",
    purpose: "Major purchases with live approved / actual / committed / remaining.",
  },
  "capital/replacements": {
    slug: "capital/replacements",
    title: "Capital · Replacements",
    purpose: "Replacement capital items tied to existing equipment — not a duplicate asset master.",
  },
  "lifecycle/replacement": {
    slug: "lifecycle/replacement",
    title: "Replacement Forecast",
    purpose: "1 / 2 / 3 / 5 / 10 year replacement views from useful life, age, and assumptions.",
  },
  "lifecycle/service": {
    slug: "lifecycle/service",
    title: "Service Forecast",
    purpose: "Upcoming PM expenditures 30 / 60 / 90 days and 6 / 12 months.",
  },
  "lifecycle/cost": {
    slug: "lifecycle/cost",
    title: "Lifecycle Cost",
    purpose: "Acquisition + maintenance to date, annualized maintenance, and contributing factors — no hidden AI score.",
  },
  "planner/current": {
    slug: "planner/current",
    title: "Budget Planner · Current Year",
    purpose: "This year’s operating and capital lines. Edit approved amounts; ORIGINAL history is kept.",
  },
  "planner/next-year": {
    slug: "planner/next-year",
    title: "Next Year builder",
    purpose: "Guided next-year envelope from actuals, commitments, PM, contracts, replacements, and deferred work.",
  },
  "planner/long-range": {
    slug: "planner/long-range",
    title: "5–10 Year Forecast",
    purpose: "Multi-year capital matrix, peak pressure years, and funding gaps.",
  },
  "scenarios/replace": {
    slug: "scenarios/replace",
    title: "Scenario · Replace",
    purpose: "Replace now / next year / in 3 years — consequences only, no auto decision.",
  },
  "scenarios/repair": {
    slug: "scenarios/repair",
    title: "Scenario · Repair",
    purpose: "Repair and keep the asset. Residual failure risk stays visible.",
  },
  "scenarios/defer": {
    slug: "scenarios/defer",
    title: "Scenario · Defer",
    purpose: "Do nothing this year. Future inflated replacement and service risk are shown, not chosen for you.",
  },
  "scenarios/compare": {
    slug: "scenarios/compare",
    title: "Scenario · Compare",
    purpose: "Side-by-side asset, option, estimated cost, and risk note.",
  },
  "procurement/quotes": {
    slug: "procurement/quotes",
    title: "Quotes",
    purpose: "Vendor quotes before a PO. Accepting a quote does not encumber funds until you issue a PO.",
  },
  "procurement/pos": {
    slug: "procurement/pos",
    title: "Purchase orders",
    purpose: "Issuing a PO creates a commitment. Invoices later reduce that commitment and raise actual.",
  },
  "procurement/invoices": {
    slug: "procurement/invoices",
    title: "Invoices",
    purpose: "Posting an invoice increases actual and reduces remaining PO commitment — never both for the same dollars.",
  },
  "procurement/contracts": {
    slug: "procurement/contracts",
    title: "Contracts",
    purpose: "Service agreements with annual cost, expiry, and renewal. Feed the operating forecast.",
  },
  deferred: {
    slug: "deferred",
    title: "Deferred Maintenance",
    purpose: "Unfunded repairs and replacements linked to existing assets and open work requests.",
  },
  funding: {
    slug: "funding",
    title: "Funding Sources",
    purpose: "Taxation, reserves, grants, and other sources. Assign them on budget lines and capital items.",
  },
  assistant: {
    slug: "assistant",
    title: "Budget Assistant",
    purpose: "Ask why a number is here. Answers cite Pulse records. The assistant cannot spend or approve.",
  },
  opportunities: {
    slug: "opportunities",
    title: "Budget Opportunities",
    purpose: "Uncommitted remainder against legitimate needs. “No spend recommended” is a valid outcome.",
  },
  history: {
    slug: "history",
    title: "Budget History",
    purpose: "ORIGINAL / REVISED / ACTUAL snapshots. Approved amounts are never silently overwritten.",
  },
  assumptions: {
    slug: "assumptions",
    title: "Budget Assumptions",
    purpose: "Inflation, contingency, source, and date. Changing them recalculates replacement and next-year forecasts.",
  },
  justifications: {
    slug: "justifications",
    title: "Capital justifications",
    purpose: "Structured write-up for a manager or finance review. Generating it does not approve spend.",
  },
  alerts: {
    slug: "alerts",
    title: "Alerts",
    purpose: "Approaching limit, overrun forecast, uncommitted remainder, replacements, renewals, and PM without cost.",
  },
  reports: {
    slug: "reports",
    title: "Reports",
    purpose: "Export the calculation envelope to CSV. Excel/PDF can be printed from the browser.",
  },
};

export function leafFromPath(slug: string[] | undefined): FinanceLeaf {
  if (!slug?.length) {
    return {
      slug: "",
      title: "Financial & Asset Planning",
      purpose:
        "Municipal recreation budgeting, asset lifecycle, maintenance, procurement, and capital planning — one line of sight from asset condition to next year’s plan.",
    };
  }
  const key = slug.join("/");
  return (
    FINANCE_LEAVES[key] ?? {
      slug: key,
      title: key,
      purpose: "Financial & Asset Planning.",
    }
  );
}
