/**
 * Communications workspace — shared domain types (client-only scaffold).
 * Future: sync with Supabase / API; keep shapes stable for ingestion services.
 */

/** Normalized 0–100 canvas coordinates (wall-relative). */
export type CanvasRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AdSlotStatus = "available" | "reserved" | "occupied" | "expired";

export type AdSlot = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: AdSlotStatus;
  sponsorName?: string;
  assetUrl?: string;
  expiryDate?: string;
};

export type FacilityWallId = string;

export type FacilityWallLayout = {
  id: FacilityWallId;
  name: string;
  /** Visual aspect hint for canvas (width / height). */
  aspectRatio: number;
  /** Optional grid columns for snap math (future). */
  gridCols?: number;
  slots: AdSlot[];
};

export type CampaignStatus = "planning" | "awaiting_assets" | "design" | "scheduled" | "published";

export type Campaign = {
  id: string;
  title: string;
  department: string;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  channels: string[];
  assignedTo?: string[];
  assets?: string[];
  description?: string;
  deadlines?: { label: string; date: string }[];
};

export type CrossDepartmentRequest = {
  id: string;
  fromDepartment: string;
  summary: string;
  status: "open" | "in_review" | "scheduled" | "done";
  createdAt: string;
};

export type CalendarLayerKind = "campaign" | "event" | "facility_notice" | "closure";

/** Unified layer for combined calendar (mock until feeds exist). */
export type CalendarLayerItem = {
  id: string;
  kind: CalendarLayerKind;
  title: string;
  startDate: string;
  endDate: string;
  /** Tailwind-friendly hue class suffix or token name. */
  accent?: "violet" | "sky" | "amber" | "rose" | "emerald";
};

export type PublicationWorkflowStageId = "upload" | "parse" | "transform" | "preview" | "export";

export type PublicationUploadFile = {
  id: string;
  name: string;
  sizeLabel: string;
  status: "queued" | "uploading" | "ready" | "error";
  detectedFormat?: string;
};

export type PublicationRuleType = "remove_field" | "rename_field" | "reorder" | "apply_style" | "group_sections";

export type PublicationTransformRule = {
  id: string;
  type: PublicationRuleType;
  label: string;
  detail?: string;
  enabled: boolean;
};

export type PublicationTemplateId =
  | "seasonal_recreation"
  | "aquatics_guide"
  | "fitness_brochure"
  | "event_flyer";

export type PublicationTemplate = {
  id: PublicationTemplateId;
  name: string;
  description: string;
};

export type PublicationExportFormat = "indesign_tagged" | "docx" | "xml" | "json";
