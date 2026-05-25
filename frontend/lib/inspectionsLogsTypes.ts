/**
 * Client-side model for Inspections & Logs (templates + submitted entries).
 * Persisted in localStorage per company/user scope until a backend exists.
 */

export type TemplateType = "inspection" | "log";

/** How an inspection line is answered when someone submits a run (default: checkbox). */
export type InspectionItemResponseType = "checkbox" | "text" | "number" | "notes" | "yes_no";

export type InspectionChecklistItem = {
  id: string;
  label: string;
  order: number;
  response_type?: InspectionItemResponseType;
};

/** Equipment choices for multi-asset templates (e.g. John Deere vs Ventrac). */
export type InspectionEquipmentOption = {
  id: string;
  label: string;
};

/** Log template field kinds — add several of each type as needed. */
export type LogFieldType = "text" | "number" | "notes" | "checkbox" | "yes_no";

export type LogFieldDef = {
  id: string;
  label: string;
  type: LogFieldType;
  order: number;
};

export type AutomationHints = {
  /** @deprecated Prefer `equipment_options`. Kept for older saved templates. */
  linked_equipment_id?: string | null;
  linked_zone_id?: string | null;
  /** e.g. "daily" — reserved for future scheduling */
  frequency?: string | null;
};

export type InspectionTemplate = AutomationHints & {
  id: string;
  type: "inspection";
  name: string;
  description?: string;
  checklist_items: InspectionChecklistItem[];
  /** When 2+ options, run sheet shows a required equipment dropdown. */
  equipment_options?: InspectionEquipmentOption[];
  created_at: string;
  updated_at: string;
};

export type LogTemplate = AutomationHints & {
  id: string;
  type: "log";
  name: string;
  description?: string;
  fields: LogFieldDef[];
  created_at: string;
  updated_at: string;
};

export type TemplateUnion = InspectionTemplate | LogTemplate;

/** Values: inspection → item id → checked; log → field id → string | number */
export type EntryRecord = {
  id: string;
  template_id: string;
  template_type: TemplateType;
  values: Record<string, unknown>;
  created_at: string;
  user_id?: string | null;
};

export type InspectionsLogsStoreData = {
  templates: TemplateUnion[];
  entries: EntryRecord[];
};
