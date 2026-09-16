/**
 * Curated “where do I go?” destinations for in-app Ask / Search.
 * Intent phrases and keywords map plain-language ops questions to Pulse routes.
 * Access is enforced by the router (RBAC + feature flags) — do not treat this list as authorized.
 */

export type OpsAskCatalogItem = {
  id: string;
  title: string;
  href: string;
  /** One-line reason shown in results. */
  why: string;
  /** Optional short how-to after they land. */
  howTo?: string;
  /** Exact-ish phrases that strongly match a question. */
  phrases: readonly string[];
  /** Extra tokens that boost ranking. */
  keywords: readonly string[];
  /**
   * When set, a strong match can also run Ops Copilot for record citations.
   * Copilot is an enhancer — navigation is the primary job.
   */
  copilotPromptId?: string;
  /** Prefer this row when several destinations score similarly. */
  weight?: number;
  /** Suggested when nothing matches (still filtered by access). */
  browseFallback?: boolean;
  /** Build a more specific href from the typed question (e.g. equipment search). */
  hrefForQuery?: (normalizedQuery: string) => string;
};

function equipmentSearchHref(normalizedQuery: string): string {
  if (/\bice\s*plant\b|\bammonia\b|\bzamboni\b|\bresurfacer\b|\brefrigerat/.test(normalizedQuery)) {
    return "/equipment?q=ice%20plant";
  }
  if (/\bpool\b|\baquatic\b|\bwater\s*quality\b/.test(normalizedQuery)) {
    return "/equipment?q=pool";
  }
  return "/equipment";
}

function placeFromAtQuery(normalizedQuery: string): string | null {
  const m = normalizedQuery.match(/\b(?:at|in)\s+(?:the\s+)?(.+)$/);
  if (!m) return null;
  return m[1].replace(/[?!.,]+$/g, "").trim() || null;
}

function assetsAtHref(normalizedQuery: string): string {
  const place = placeFromAtQuery(normalizedQuery);
  if (place) return `/equipment?q=${encodeURIComponent(place)}`;
  return "/equipment";
}

function inventoryAtHref(normalizedQuery: string): string {
  const place = placeFromAtQuery(normalizedQuery);
  if (place) return `/dashboard/inventory?q=${encodeURIComponent(place)}`;
  return "/dashboard/inventory";
}

function facilitiesPlaceHref(normalizedQuery: string): string {
  const place = placeFromAtQuery(normalizedQuery);
  if (place) return `/recreation/facilities?q=${encodeURIComponent(place)}`;
  if (/\badd\b|\bcreate\b|\bnew\b/.test(normalizedQuery)) return "/recreation/facilities?create=1";
  return "/recreation/facilities";
}

function codesGuidanceHref(normalizedQuery: string): string {
  const q = normalizedQuery.trim();
  if (!q) return "/recreation/regulations";
  return `/recreation/regulations?q=${encodeURIComponent(q)}`;
}

/** Starter questions shown in the empty Ask palette. */
export const OPS_ASK_EXAMPLE_QUERIES = [
  "Where do I add a PM for the ice plant?",
  "Add a facility",
  "Assets at the arena",
  "Inventory at the pool",
  "How do I start a pool seasonal checklist?",
  "Where are contractor insurance expiries?",
] as const;

/** High-value browse targets when Ask is empty or unsure. */
export const OPS_ASK_BROWSE_FALLBACK_IDS = [
  "dashboard",
  "equipment",
  "inspections",
  "procedures",
  "ops-attention",
] as const;

export const OPS_ASK_CATALOG: readonly OpsAskCatalogItem[] = [
  {
    id: "dashboard",
    title: "Leadership dashboard",
    href: "/overview",
    why: "Home for overdue work, alerts, and a snapshot of the operation.",
    phrases: ["dashboard", "home", "overview", "leadership dashboard"],
    keywords: ["dashboard", "overview", "home", "alerts"],
    browseFallback: true,
    weight: 2,
  },
  {
    id: "ops-attention",
    title: "Recreation Ops Attention",
    href: "/recreation/attention",
    why: "Open exceptions across checklists, certs, contractors, and emergency readiness.",
    phrases: ["attention", "what's overdue", "whats overdue", "exceptions", "recreation ops attention"],
    keywords: ["attention", "overdue", "exceptions", "intelligence"],
    copilotPromptId: "overdue-arena",
    browseFallback: true,
    weight: 4,
  },
  {
    id: "equipment",
    title: "Equipment",
    href: "/equipment",
    why: "Asset registry — open a record to add PMs, parts, and service history.",
    howTo: "Find the asset (search by name), open it, then add a preventive maintenance task on that record.",
    phrases: ["equipment", "assets", "asset registry", "ice plant"],
    keywords: ["equipment", "asset", "assets", "ice", "plant", "pool", "chiller"],
    browseFallback: true,
    weight: 5,
    hrefForQuery: equipmentSearchHref,
  },
  {
    id: "add-pm",
    title: "Add a PM on equipment",
    href: "/equipment",
    why: "Preventive maintenance is created on the equipment record, not as a standalone list.",
    howTo:
      "Open Equipment, find the asset (for example the ice plant), open it, then use Add PM on that record to set frequency and checklist.",
    phrases: [
      "add a pm",
      "add pm",
      "add a pm for the ice plant",
      "pm for the ice plant",
      "preventive maintenance",
      "create a pm",
      "ice plant pm",
    ],
    keywords: ["pm", "preventive", "maintenance", "ice", "plant", "ammonia", "schedule"],
    copilotPromptId: "assets-without-pms",
    weight: 12,
    hrefForQuery: equipmentSearchHref,
  },
  {
    id: "pm-workspace",
    title: "PM workspace",
    href: "/dashboard/pm-workspace",
    why: "Planning view of preventive maintenance work across assets.",
    phrases: ["pm workspace", "pm planning"],
    keywords: ["pm", "workspace", "planning", "gantt"],
    weight: 3,
  },
  {
    id: "inspections",
    title: "Logs & Inspections",
    href: "/dashboard/compliance",
    why: "Run checklists, record results, and keep a defensible inspection history.",
    howTo: "Start or open an inspection. Failed lines can create a linked work request in one tap.",
    phrases: ["inspections", "logs and inspections", "start an inspection", "run an inspection"],
    keywords: ["inspection", "inspections", "log", "logs", "checklist", "audit"],
    browseFallback: true,
    weight: 6,
  },
  {
    id: "wr-from-inspection",
    title: "Create a work request from a failed inspection",
    href: "/dashboard/compliance",
    why: "Failed inspection lines can open a corrective work request linked to the asset and facility.",
    howTo:
      "Open Logs & Inspections, complete or reopen the run, then on a failed line tap Create work request. Pulse copies notes and evidence onto the request.",
    phrases: [
      "create a work request from a failed inspection",
      "work request from a failed inspection",
      "failed inspection",
      "corrective action",
      "corrective work request",
    ],
    keywords: ["failed", "inspection", "work", "request", "corrective", "fail"],
    weight: 14,
  },
  {
    id: "work-requests",
    title: "Work Requests",
    href: "/dashboard/maintenance",
    why: "Open, assign, and close maintenance work requests.",
    howTo: "Create a request here, or generate one from a failed inspection line.",
    phrases: ["work requests", "work request", "work order", "create a work request"],
    keywords: ["work", "request", "requests", "wo", "maintenance", "ticket"],
    weight: 7,
  },
  {
    id: "seasonal-checklists",
    title: "Seasonal checklists",
    href: "/recreation/checklists?category=seasonal",
    why: "Arena freeze-up, pool open, and playground seasonal startup lists live here.",
    howTo:
      "Pick the facility and season year, then start the pool (or arena / playground) seasonal template. Incomplete items stay visible until checked.",
    phrases: [
      "start a pool seasonal checklist",
      "pool seasonal checklist",
      "seasonal checklist",
      "seasonal startup",
      "pool open checklist",
      "arena freeze-up",
    ],
    keywords: ["seasonal", "checklist", "pool", "arena", "startup", "freeze", "playground"],
    weight: 13,
  },
  {
    id: "checklists",
    title: "Checklists",
    href: "/recreation/checklists",
    why: "Onboarding lists plus seasonal startup checklists.",
    phrases: ["checklists", "onboarding checklist"],
    keywords: ["checklist", "checklists", "onboarding"],
    weight: 4,
  },
  {
    id: "contractors",
    title: "Contractor insurance & WCB",
    href: "/recreation/contractors",
    why: "Contractor pack with COI / insurance and WCB expiry status.",
    howTo: "Open Contractors and check insurance / WCB dates. Expired or missing coverage is flagged on the pack.",
    phrases: [
      "contractor insurance expiries",
      "contractor insurance",
      "contractor insurance / wcb",
      "wcb status",
      "certificate of insurance",
    ],
    keywords: ["contractor", "contractors", "insurance", "wcb", "coi", "expiry", "expiries"],
    copilotPromptId: "contractor-insurance",
    weight: 13,
  },
  {
    id: "ammonia-emergency",
    title: "Ammonia emergency procedure",
    href: "/recreation/emergency",
    why: "Emergency hub for ice plant / ammonia response, contacts, and playbooks.",
    howTo:
      "Start on Emergency Response, then open the facility profile, emergency contacts, or Knowledge Base article. Ops Copilot can cite the internal procedure on file.",
    phrases: [
      "show ammonia emergency procedure",
      "ammonia emergency procedure",
      "ammonia release",
      "ammonia emergency",
      "ice plant emergency",
    ],
    keywords: ["ammonia", "emergency", "release", "ice", "plant", "refrigeration"],
    copilotPromptId: "ammonia-release",
    weight: 14,
  },
  {
    id: "emergency",
    title: "Emergency Response",
    href: "/recreation/emergency",
    why: "Personal readiness hub — procedures, contacts, and gaps under pressure.",
    phrases: ["emergency", "emergency response", "pool emergency"],
    keywords: ["emergency", "evacuation", "spill", "drowning"],
    copilotPromptId: "pool-emergency",
    weight: 8,
  },
  {
    id: "codes-guidance",
    title: "Codes & Guidance",
    href: "/recreation/regulations",
    why: "Regulatory reference library — official public sources, not legal advice.",
    howTo:
      "Filter by topic or search. Each card points at a public regulator or municipal page. Confirm current wording on the official source; Pulse summaries are not a legal determination.",
    phrases: [
      "chief engineer responsibilities",
      "chief engineer",
      "interior health pool code",
      "interior health",
      "pool code",
      "pool regulation",
      "building code",
      "bc building code",
      "ohs",
      "oh and s",
      "worksafebc",
      "refrigeration plant requirements",
      "refrigeration plant",
      "refrigeration operator",
      "ice facility operator",
      "ammonia safety order",
      "codes and guidance",
      "regulatory library",
      "technical safety bc",
      "tsbc",
    ],
    keywords: [
      "chief",
      "engineer",
      "ohs",
      "worksafebc",
      "building",
      "code",
      "interior",
      "health",
      "regulation",
      "tsbc",
      "refrigeration",
      "whmis",
      "playground",
      "z614",
      "codes",
      "guidance",
      "electrical",
      "ammonia",
      "safety",
      "order",
      "operator",
    ],
    weight: 16,
    hrefForQuery: codesGuidanceHref,
  },
  {
    id: "procedures",
    title: "Procedures",
    href: "/training/learning/library",
    why: "Internal SOPs and procedure library (not a regulatory citation).",
    phrases: ["procedures", "sops", "sop", "standards"],
    keywords: ["procedure", "procedures", "sop", "sops", "standard", "policy"],
    browseFallback: true,
    weight: 5,
  },
  {
    id: "knowledge",
    title: "Knowledge Base",
    href: "/recreation/knowledge",
    why: "Searchable playbooks including emergency procedures.",
    phrases: ["knowledge base", "knowledge articles", "playbooks"],
    keywords: ["knowledge", "article", "playbook", "emergency"],
    weight: 6,
  },
  {
    id: "add-facility",
    title: "Add a facility",
    href: "/recreation/facilities?create=1",
    why: "Name a building (Arena, Aquatic Centre) so inventory and equipment can link to it.",
    howTo: "Tap Add facility, type the name, Save. Then pick that facility when you add inventory or assets.",
    phrases: [
      "add facility",
      "add a facility",
      "create facility",
      "new facility",
      "add an arena",
      "add aquatic centre",
    ],
    keywords: ["facility", "facilities", "arena", "pool", "building", "add", "create"],
    weight: 15,
  },
  {
    id: "assets-at-facility",
    title: "Assets at a facility",
    href: "/equipment",
    why: "Main equipment list — filter or search by facility name.",
    howTo: "Open Equipment and pick a facility filter, or open Facilities and see what that building has.",
    phrases: ["assets at arena", "assets at the arena", "equipment at arena", "equipment at the pool"],
    keywords: ["assets", "equipment", "arena", "pool", "facility"],
    weight: 12,
    hrefForQuery: assetsAtHref,
  },
  {
    id: "inventory-at-facility",
    title: "Inventory at a facility",
    href: "/dashboard/inventory",
    why: "Stock list — search or filter by the facility you named.",
    howTo: "Open Inventory and choose a facility filter, or open the facility to see linked stock.",
    phrases: ["inventory at pool", "inventory at the pool", "stock at arena", "inventory at the aquatic centre"],
    keywords: ["inventory", "stock", "pool", "arena", "facility"],
    weight: 12,
    hrefForQuery: inventoryAtHref,
  },
  {
    id: "facilities",
    title: "Facilities",
    href: "/recreation/facilities",
    why: "Facility list — add buildings and see which assets and inventory each one has.",
    howTo: "Add a facility by name, then link inventory and equipment to it. Open a facility to see what it contains.",
    phrases: [
      "facilities",
      "facility profile",
      "arena",
      "aquatic centre",
      "what's at the arena",
      "whats at the arena",
      "what does the pool have",
    ],
    keywords: ["facility", "facilities", "arena", "pool", "building"],
    weight: 8,
    hrefForQuery: facilitiesPlaceHref,
  },
  {
    id: "certs",
    title: "Training & certifications",
    href: "/training/compliance/workers?panel=certifications",
    why: "Staff certifications and expiry — refrigeration, lifeguard, and the rest.",
    howTo: "Open the certifications panel on the worker record to add or renew tickets.",
    phrases: ["certifications", "training certs", "who is qualified", "cert expiry"],
    keywords: ["cert", "certs", "certification", "training", "qualified", "expiry", "whmis"],
    copilotPromptId: "certs-this-month",
    weight: 8,
  },
  {
    id: "inventory",
    title: "Inventory",
    href: "/dashboard/inventory",
    why: "Stock, vendors, receipts, and related asset supplies.",
    phrases: ["inventory", "stock", "parts inventory"],
    keywords: ["inventory", "stock", "parts", "supplies", "reorder"],
    weight: 4,
  },
  {
    id: "qr",
    title: "QR codes",
    href: "/dashboard/inventory?tab=qr_codes",
    why: "Print and manage QR labels that open equipment, zones, and records.",
    phrases: ["qr codes", "qr code", "scan qr"],
    keywords: ["qr", "barcode", "scan", "label"],
    weight: 6,
  },
  {
    id: "schedule",
    title: "Schedule",
    href: "/schedule",
    why: "Shifts, coverage, and who is on today.",
    phrases: ["schedule", "shifts", "who is on"],
    keywords: ["schedule", "shift", "shifts", "coverage", "roster"],
    weight: 4,
  },
  {
    id: "ops-copilot",
    title: "Ops Copilot",
    href: "/recreation/copilot",
    why: "Starter questions answered from Pulse records and Codes & Guidance cards — not an LLM.",
    phrases: ["ops copilot", "copilot", "ask copilot"],
    keywords: ["copilot", "ask", "overdue", "qualified", "codes", "guidance"],
    weight: 5,
  },
  {
    id: "contacts",
    title: "Emergency contacts",
    href: "/recreation/contacts",
    why: "Ops contacts including fire, utilities, and after-hours callout.",
    phrases: ["emergency contacts", "callout list"],
    keywords: ["contacts", "callout", "phone", "after-hours"],
    weight: 4,
  },
];

/** Ops Copilot prompt library (mirrors backend) for intent matching — not LLM prompts. */
export const OPS_COPILOT_PROMPT_MATCHERS: readonly {
  id: string;
  label: string;
  phrases: readonly string[];
}[] = [
  {
    id: "overdue-arena",
    label: "What's overdue at the arena?",
    phrases: ["overdue at the arena", "arena overdue", "ice plant overdue"],
  },
  {
    id: "overdue-aquatic",
    label: "What's overdue at the aquatic centre?",
    phrases: ["overdue at the aquatic", "pool overdue", "aquatic overdue"],
  },
  {
    id: "qualified-ice-plant",
    label: "Who is qualified for ice plant / ammonia work?",
    phrases: ["who is qualified", "qualified for ice plant", "ammonia work", "refrigeration ticket"],
  },
  {
    id: "ammonia-release",
    label: "Ammonia release response",
    phrases: ["ammonia release", "ammonia emergency", "ammonia procedure"],
  },
  {
    id: "pool-emergency",
    label: "Pool emergency / water quality",
    phrases: ["pool emergency", "water quality issue", "drowning"],
  },
  {
    id: "certs-this-month",
    label: "Certifications expiring this month",
    phrases: ["certs expiring", "certifications expiring", "tickets expiring"],
  },
  {
    id: "contractor-insurance",
    label: "Contractor insurance / WCB status",
    phrases: ["contractor insurance", "wcb status", "coi expiry"],
  },
  {
    id: "assets-without-pms",
    label: "Critical assets without current PMs",
    phrases: ["assets without pm", "no preventive maintenance", "assets without current pms"],
  },
  {
    id: "chief-engineer",
    label: "Chief engineer responsibilities",
    phrases: ["chief engineer responsibilities", "chief engineer", "power engineer in charge", "refrigeration operator", "ice facility operator"],
  },
  {
    id: "ohs-worksafebc",
    label: "OH&S / WorkSafeBC",
    phrases: ["ohs", "oh and s", "worksafebc", "occupational health"],
  },
  {
    id: "building-code",
    label: "BC Building Code",
    phrases: ["building code", "bc building code", "bc codes"],
  },
  {
    id: "interior-health-pools",
    label: "Interior Health / pool code",
    phrases: ["interior health pool code", "interior health", "pool code", "pool regulation"],
  },
  {
    id: "refrigeration-plant",
    label: "Refrigeration plant / TSBC",
    phrases: ["refrigeration plant requirements", "refrigeration plant", "technical safety bc", "tsbc", "ammonia safety order", "general supervision"],
  },
];
