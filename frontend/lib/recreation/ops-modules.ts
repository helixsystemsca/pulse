/**
 * Recreation Operations foundation — module definitions (Phase 0 IA).
 * All modules share the `recreation_ops` contract feature and entity-link graph.
 */

export type OpsEntityType =
  | "knowledge"
  | "meetings"
  | "people"
  | "contractors"
  | "regulations"
  | "facilities"
  | "quick-notes"
  | "contacts";

export type OpsFieldType = "text" | "textarea" | "select" | "tags" | "date" | "checkbox" | "json-list";

export type OpsFieldDef = {
  key: string;
  label: string;
  type: OpsFieldType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
};

export type OpsModuleDef = {
  entityType: OpsEntityType;
  key: string;
  label: string;
  singular: string;
  description: string;
  route: string;
  icon: string;
  fields: OpsFieldDef[];
  linkableTypes: OpsEntityType[];
};

const SHARED_STATUS: OpsFieldDef = {
  key: "status",
  label: "Status",
  type: "select",
  options: ["active", "draft", "archived"],
};

const SHARED_TAGS: OpsFieldDef = { key: "tags", label: "Tags", type: "tags", placeholder: "Comma-separated tags" };
const SHARED_NOTES: OpsFieldDef = { key: "notes", label: "Notes", type: "textarea" };
const SHARED_DESC: OpsFieldDef = { key: "description", label: "Description", type: "textarea" };

const ALL: OpsEntityType[] = [
  "knowledge",
  "meetings",
  "people",
  "contractors",
  "regulations",
  "facilities",
  "quick-notes",
  "contacts",
];

export const OPS_MODULES: readonly OpsModuleDef[] = [
  {
    entityType: "knowledge",
    key: "ops_knowledge",
    label: "Ops Knowledge",
    singular: "Article",
    description: "Searchable operational notes — facility notes, troubleshooting, lessons learned. Codes & Guidance is the regulatory library.",
    route: "/recreation/knowledge",
    icon: "book-open",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      {
        key: "category",
        label: "Category",
        type: "select",
        options: [
          "Facility Notes",
          "Lessons Learned",
          "Troubleshooting",
          "Seasonal Operations",
          "Operational Tips",
          "Best Practices",
          "Vendor Information",
          "Emergency Procedures",
        ],
      },
      SHARED_STATUS,
      SHARED_DESC,
      { key: "body_rich", label: "Article body", type: "textarea", placeholder: "Rich text / markdown content" },
      SHARED_TAGS,
      SHARED_NOTES,
    ],
    linkableTypes: ["facilities", "regulations", "contractors", "people", "meetings"],
  },
  {
    entityType: "meetings",
    key: "ops_meetings",
    label: "Meetings",
    singular: "Meeting",
    description: "Capture meeting notes, decisions, and action items.",
    route: "/recreation/meetings",
    icon: "users",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "meeting_date", label: "Date", type: "date" },
      SHARED_STATUS,
      SHARED_DESC,
      { key: "participants", label: "Participants", type: "tags", placeholder: "Names, comma-separated" },
      { key: "decisions", label: "Decisions", type: "json-list", placeholder: "One decision per line" },
      { key: "action_items", label: "Action items", type: "json-list", placeholder: "One action per line (include due dates in text)" },
      SHARED_TAGS,
      SHARED_NOTES,
    ],
    linkableTypes: ["people", "facilities", "contractors", "quick-notes", "contacts"],
  },
  {
    entityType: "people",
    key: "ops_people",
    label: "People",
    singular: "Person",
    description: "Operational staff directory — not an HR system.",
    route: "/recreation/people",
    icon: "users",
    fields: [
      { key: "title", label: "Name", type: "text", required: true },
      { key: "position", label: "Position", type: "text" },
      { key: "department", label: "Department", type: "text" },
      { key: "team_name", label: "Team", type: "text" },
      { key: "role_label", label: "Role", type: "text" },
      { key: "reports_to_person_id", label: "Reports to (person id)", type: "text", placeholder: "Paste manager person UUID from org chart" },
      SHARED_STATUS,
      { key: "responsibilities", label: "Responsibilities", type: "textarea" },
      { key: "expertise", label: "Areas of expertise", type: "tags" },
      { key: "certifications", label: "Certifications", type: "tags" },
      { key: "training", label: "Training", type: "tags" },
      { key: "cross_training", label: "Cross training", type: "tags" },
      { key: "strengths", label: "Strengths", type: "textarea" },
      { key: "development_opportunities", label: "Development opportunities", type: "textarea" },
      { key: "current_priorities", label: "Current priorities", type: "textarea" },
      { key: "projects_notes", label: "Projects", type: "textarea" },
      { key: "important_relationships", label: "Important relationships", type: "textarea" },
      { key: "need_from_me", label: "What they need from me", type: "textarea" },
      { key: "need_from_them", label: "What I need from them", type: "textarea" },
      { key: "decision_authority", label: "Decision authority", type: "textarea" },
      {
        key: "communication_preference",
        label: "Communication preference",
        type: "select",
        options: ["in_person", "phone", "email", "teams", "text", "other"],
      },
      SHARED_DESC,
      SHARED_TAGS,
      SHARED_NOTES,
    ],
    linkableTypes: ["meetings", "facilities", "contacts", "quick-notes"],
  },
  {
    entityType: "contractors",
    key: "ops_contractors",
    label: "Contractors",
    singular: "Contractor",
    description: "Contractor pack — insurance, WCB, tickets, rates, and facilities/assets serviced. Highlight expired coverage on the list.",
    route: "/recreation/contractors",
    icon: "wrench",
    fields: [
      { key: "title", label: "Display name", type: "text", required: true },
      { key: "company_name", label: "Company", type: "text" },
      { key: "primary_contact", label: "Primary contact", type: "text" },
      { key: "contact_email", label: "Contact email", type: "text" },
      { key: "contact_phone", label: "Contact phone", type: "text" },
      { key: "trade", label: "Trade", type: "text", placeholder: "Refrigeration / ammonia, pool equipment, HVAC…" },
      { key: "services_provided", label: "Services provided", type: "textarea" },
      { key: "emergency_contact", label: "Emergency / after-hours contact", type: "text" },
      { key: "preferred_vendor", label: "Preferred vendor", type: "checkbox" },
      { key: "insurance_carrier", label: "Insurance carrier", type: "text" },
      { key: "insurance_policy", label: "Insurance / COI policy #", type: "text" },
      { key: "insurance_expiry", label: "Insurance expiry", type: "date" },
      { key: "wcb_account", label: "WCB / WorkSafeBC account", type: "text" },
      { key: "wcb_expiry", label: "WCB expiry", type: "date" },
      { key: "hourly_rate", label: "Hourly rate", type: "text" },
      { key: "after_hours_rate", label: "After-hours rate", type: "text" },
      {
        key: "tickets",
        label: "Certifications / tickets (one per line, optional expiry as JSON)",
        type: "json-list",
        placeholder: "Refrigeration ticket\nWHMIS",
      },
      { key: "safety_docs", label: "Safety documents on file", type: "json-list" },
      { key: "agreements", label: "Agreements", type: "json-list" },
      { key: "serviced_assets", label: "Assets serviced", type: "tags", placeholder: "Ice plant, pool pump…" },
      { key: "serviced_facilities", label: "Facilities serviced", type: "tags", placeholder: "Arena, Aquatic Centre…" },
      SHARED_STATUS,
      SHARED_DESC,
      SHARED_TAGS,
      SHARED_NOTES,
    ],
    linkableTypes: ["facilities", "contacts", "regulations", "meetings"],
  },
  {
    entityType: "regulations",
    key: "ops_regulations",
    label: "Codes & Guidance",
    singular: "Reference card",
    description:
      "Regulatory reference library — TSBC ammonia / chief engineer / PEBPVRSR pointers to official public sources (not legal advice).",
    route: "/recreation/regulations",
    icon: "scroll-text",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      {
        key: "topic_category",
        label: "Topic category",
        type: "select",
        options: [
          "Chief Engineer",
          "OH&S",
          "Building Code",
          "Interior Health / Pools",
          "Refrigeration / TSBC",
          "Fire",
          "Electrical",
          "Playground",
          "Chemicals",
          "Emergency",
          "Other",
        ],
      },
      {
        key: "classification",
        label: "Classification",
        type: "select",
        options: [
          "Law/Regulation",
          "Regulator guidance",
          "Municipal policy",
          "Industry standard",
          "Best practice",
          "Internal note",
        ],
      },
      {
        key: "verification_status",
        label: "Verification status",
        type: "select",
        options: ["Unverified", "Needs municipal confirmation", "Reviewed"],
      },
      { key: "review_date", label: "Review date", type: "date" },
      { key: "applicability", label: "Applicability", type: "textarea", placeholder: "Arena ice plant, aquatic centre…" },
      { key: "summary", label: "Plain-language summary", type: "textarea" },
      { key: "authority", label: "Authority / organization", type: "text" },
      { key: "regulation_name", label: "Official instrument name", type: "text" },
      { key: "official_source_name", label: "Official source name", type: "text" },
      { key: "official_source_url", label: "Official reference URL", type: "text", placeholder: "https://…" },
      { key: "external_references", label: "Additional public URLs", type: "json-list" },
      { key: "requirements", label: "Notes (do not paste copyrighted code)", type: "textarea" },
      SHARED_STATUS,
      SHARED_DESC,
      SHARED_TAGS,
      SHARED_NOTES,
    ],
    linkableTypes: ["facilities", "knowledge", "contractors"],
  },
  {
    entityType: "facilities",
    key: "ops_facilities",
    label: "Facilities",
    singular: "Facility",
    description: "Buildings you operate — add a name, then link inventory and equipment to each facility.",
    route: "/recreation/facilities",
    icon: "building",
    fields: [
      { key: "title", label: "Facility name", type: "text", required: true },
      SHARED_STATUS,
      SHARED_DESC,
      { key: "building_info", label: "Building information", type: "textarea" },
      { key: "mechanical_systems", label: "Mechanical systems", type: "textarea" },
      { key: "emergency_procedures", label: "Emergency procedures", type: "textarea" },
      SHARED_TAGS,
      SHARED_NOTES,
    ],
    linkableTypes: ["contractors", "contacts", "regulations", "knowledge", "quick-notes", "people"],
  },
  {
    entityType: "quick-notes",
    key: "ops_quick_notes",
    label: "Quick Notes",
    singular: "Note",
    description: "Capture information while walking facilities — text, tags, priority, follow-up.",
    route: "/recreation/quick-notes",
    icon: "clipboard",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        options: ["low", "normal", "high", "urgent"],
      },
      {
        key: "follow_up_status",
        label: "Follow-up status",
        type: "select",
        options: ["open", "in_progress", "done", "deferred"],
      },
      SHARED_STATUS,
      SHARED_DESC,
      SHARED_TAGS,
      SHARED_NOTES,
    ],
    linkableTypes: ["facilities", "people", "contractors", "meetings"],
  },
  {
    entityType: "contacts",
    key: "ops_contacts",
    label: "Contacts",
    singular: "Contact",
    description: "Central operational contact directory — staff, vendors, utilities, agencies.",
    route: "/recreation/contacts",
    icon: "megaphone",
    fields: [
      { key: "title", label: "Name", type: "text", required: true },
      {
        key: "contact_type",
        label: "Type",
        type: "select",
        options: [
          "staff",
          "contractor",
          "vendor",
          "supplier",
          "utility",
          "emergency",
          "technical_safety_bc",
          "interior_health",
          "fire_department",
          "agency",
          "other",
        ],
      },
      { key: "organization", label: "Organization", type: "text" },
      { key: "role_label", label: "Role", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "text" },
      SHARED_STATUS,
      SHARED_DESC,
      SHARED_TAGS,
      SHARED_NOTES,
    ],
    linkableTypes: ALL.filter((t) => t !== "contacts"),
  },
] as const;

export function getOpsModule(entityType: OpsEntityType): OpsModuleDef {
  const mod = OPS_MODULES.find((m) => m.entityType === entityType);
  if (!mod) throw new Error(`Unknown ops module: ${entityType}`);
  return mod;
}

export function opsEntityLabel(entityType: string): string {
  return OPS_MODULES.find((m) => m.entityType === entityType)?.singular ?? entityType;
}
