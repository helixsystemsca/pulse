import type { TrainingTier } from "./types";
import { normalizeProcedureTrackingTags, type ProcedureTrackingTagId } from "./procedureTrackingTags";

export type ProcedureComplianceConfig = {
  tier: TrainingTier;
  /** Optional: routines completion window in days (used for overdue notifications). */
  due_within_days: number | null;
  /** Whether to treat as needing acknowledgement when revised. */
  requires_acknowledgement: boolean;
  /** When true (default in live API), completion requires review + acknowledgment + knowledge check. */
  requires_knowledge_verification?: boolean;
  tracking_tags?: ProcedureTrackingTagId[];
  onboarding_required?: boolean;
};

export type ProcedureComplianceConfigMap = Record<string, ProcedureComplianceConfig>;

const STORAGE_KEY = "training_procedure_compliance_v1";

const DEFAULT_CONFIG: ProcedureComplianceConfig = {
  tier: "general",
  due_within_days: null,
  requires_acknowledgement: true,
  requires_knowledge_verification: true,
  tracking_tags: [],
  onboarding_required: false,
};

export function readProcedureComplianceConfig(): ProcedureComplianceConfigMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: ProcedureComplianceConfigMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!k || typeof k !== "string") continue;
      if (!v || typeof v !== "object") continue;
      const o = v as Record<string, unknown>;
      const tier = o.tier;
      const due = o.due_within_days;
      const reqAck = o.requires_acknowledgement;
      const reqKv = o.requires_knowledge_verification;
      if (tier !== "mandatory" && tier !== "high_risk" && tier !== "general") continue;
      out[k] = {
        tier,
        due_within_days: typeof due === "number" && Number.isFinite(due) ? Math.max(0, Math.round(due)) : null,
        requires_acknowledgement: typeof reqAck === "boolean" ? reqAck : DEFAULT_CONFIG.requires_acknowledgement,
        requires_knowledge_verification:
          typeof reqKv === "boolean" ? reqKv : DEFAULT_CONFIG.requires_knowledge_verification,
        tracking_tags: normalizeProcedureTrackingTags(o.tracking_tags),
        onboarding_required: typeof o.onboarding_required === "boolean" ? o.onboarding_required : false,
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function writeProcedureComplianceConfig(next: ProcedureComplianceConfigMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function configForProcedure(id: string, map: ProcedureComplianceConfigMap): ProcedureComplianceConfig {
  const row = map[id];
  if (!row) return { ...DEFAULT_CONFIG };
  return {
    ...DEFAULT_CONFIG,
    ...row,
    requires_knowledge_verification:
      row.requires_knowledge_verification ?? DEFAULT_CONFIG.requires_knowledge_verification,
    tracking_tags: normalizeProcedureTrackingTags(row.tracking_tags ?? []),
    onboarding_required: row.onboarding_required ?? false,
  };
}

