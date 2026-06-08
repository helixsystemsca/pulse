import type { OperationalImprovementAnalysisType, OperationalImprovementCategory } from "@/lib/operational-improvements/types";

export type ImprovementTemplateId =
  | "inventory_materials"
  | "procurement_purchasing"
  | "maintenance_reliability"
  | "documentation_knowledge"
  | "communication_handover"
  | "scheduling_resources"
  | "safety"
  | "quality"
  | "training_onboarding"
  | "general";

export type ImprovementTemplateQuestion = {
  id: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
};

export type ImprovementTemplateDef = {
  id: ImprovementTemplateId;
  label: string;
  description: string;
  category: OperationalImprovementCategory;
  questions: ImprovementTemplateQuestion[];
  recommendedAnalyses: OperationalImprovementAnalysisType[];
  suggestedMetrics: string[];
  guidanceIntro: string;
};

export const IMPROVEMENT_TEMPLATES: readonly ImprovementTemplateDef[] = [
  {
    id: "inventory_materials",
    label: "Inventory & Materials",
    description: "Stockouts, wrong counts, locating parts, and material flow friction.",
    category: "inventory",
    guidanceIntro: "Focus on where material stops moving or becomes invisible.",
    questions: [
      { id: "symptom", label: "What stock or material issue are you seeing?", multiline: true },
      { id: "frequency", label: "How often does this happen?" },
      { id: "impact", label: "What breaks down when this happens? (downtime, rework, safety…)", multiline: true },
    ],
    recommendedAnalyses: ["root_cause_5_whys", "lean_waste", "value_stream_map"],
    suggestedMetrics: ["Stockouts", "Cycle count accuracy", "Lead time", "Inventory turns"],
  },
  {
    id: "procurement_purchasing",
    label: "Procurement & Purchasing",
    description: "Ordering delays, vendor issues, and purchasing process waste.",
    category: "procurement",
    guidanceIntro: "Trace the path from need identified to material received.",
    questions: [
      { id: "symptom", label: "Where does purchasing break down?", multiline: true },
      { id: "vendor", label: "Which vendors or categories are involved?" },
      { id: "impact", label: "Cost or schedule impact?", multiline: true },
    ],
    recommendedAnalyses: ["root_cause_5_whys", "fishbone", "value_stream_map"],
    suggestedMetrics: ["Lead time", "Cost", "Emergency orders", "Vendor response time"],
  },
  {
    id: "maintenance_reliability",
    label: "Maintenance & Reliability",
    description: "Repeat failures, PM gaps, and equipment downtime patterns.",
    category: "maintenance",
    guidanceIntro: "Separate symptoms from failure modes and recurring causes.",
    questions: [
      { id: "symptom", label: "What keeps failing or stopping work?", multiline: true },
      { id: "equipment", label: "Asset, zone, or system affected?" },
      { id: "impact", label: "Downtime, safety, or quality impact?", multiline: true },
    ],
    recommendedAnalyses: ["root_cause_5_whys", "fishbone", "lean_waste"],
    suggestedMetrics: ["Downtime", "MTBF", "Response time", "Repeat work orders"],
  },
  {
    id: "documentation_knowledge",
    label: "Documentation & Knowledge Management",
    description: "Missing SOPs, tribal knowledge, and information gaps.",
    category: "documentation",
    guidanceIntro: "Identify where people guess instead of follow a known standard.",
    questions: [
      { id: "symptom", label: "What information is missing or wrong?", multiline: true },
      { id: "audience", label: "Who needs this knowledge?" },
      { id: "impact", label: "Errors, delays, or training burden?", multiline: true },
    ],
    recommendedAnalyses: ["root_cause_5_whys", "standardization", "process_analysis"],
    suggestedMetrics: ["Defects", "Training time", "Procedure compliance", "Rework"],
  },
  {
    id: "communication_handover",
    label: "Communication & Handover",
    description: "Shift handoffs, unclear ownership, and information lost in transition.",
    category: "communication",
    guidanceIntro: "Map who needs to know what, when, and through which channel.",
    questions: [
      { id: "symptom", label: "What gets lost or misunderstood?", multiline: true },
      { id: "handoff", label: "Which handoff or team boundary?" },
      { id: "impact", label: "Operational impact of the gap?", multiline: true },
    ],
    recommendedAnalyses: ["fishbone", "value_stream_map", "process_analysis"],
    suggestedMetrics: ["Response time", "Rework", "Missed tasks", "Customer satisfaction"],
  },
  {
    id: "scheduling_resources",
    label: "Scheduling & Resource Allocation",
    description: "Coverage gaps, conflicting priorities, and idle/wait time.",
    category: "scheduling",
    guidanceIntro: "Look for waiting, overload, and mismatched capacity.",
    questions: [
      { id: "symptom", label: "Where does scheduling break?", multiline: true },
      { id: "resource", label: "People, rooms, equipment, or time slots?" },
      { id: "impact", label: "Who waits or gets overloaded?", multiline: true },
    ],
    recommendedAnalyses: ["lean_waste", "value_stream_map", "kanban"],
    suggestedMetrics: ["Wait time", "Labor hours", "Utilization", "Lead time"],
  },
  {
    id: "safety",
    label: "Safety",
    description: "Near misses, hazards, and unsafe conditions or behaviors.",
    category: "safety",
    guidanceIntro: "Treat every near miss as a system signal, not individual fault.",
    questions: [
      { id: "symptom", label: "Describe the hazard or near miss", multiline: true },
      { id: "exposure", label: "Who is exposed?" },
      { id: "impact", label: "Potential severity if unchanged?", multiline: true },
    ],
    recommendedAnalyses: ["root_cause_5_whys", "fishbone"],
    suggestedMetrics: ["Incidents", "Near misses", "Response time", "Training compliance"],
  },
  {
    id: "quality",
    label: "Quality",
    description: "Defects, rework, inconsistency, and customer-facing errors.",
    category: "quality",
    guidanceIntro: "Find where variation enters the process.",
    questions: [
      { id: "symptom", label: "What quality issue is recurring?", multiline: true },
      { id: "detection", label: "Where is it detected?" },
      { id: "impact", label: "Customer or internal impact?", multiline: true },
    ],
    recommendedAnalyses: ["root_cause_5_whys", "fishbone", "lean_waste"],
    suggestedMetrics: ["Defects", "Rework rate", "First-pass yield", "Customer satisfaction"],
  },
  {
    id: "training_onboarding",
    label: "Training & Onboarding",
    description: "Ramp time, skill gaps, and inconsistent performance for new staff.",
    category: "other",
    guidanceIntro: "Connect performance gaps to how people learn the work.",
    questions: [
      { id: "symptom", label: "What skill or knowledge gap shows up?", multiline: true },
      { id: "role", label: "Role or department affected?" },
      { id: "impact", label: "Errors, speed, or supervision load?", multiline: true },
    ],
    recommendedAnalyses: ["process_analysis", "standardization", "root_cause_5_whys"],
    suggestedMetrics: ["Training time", "Errors", "Time to proficiency", "Supervisor interventions"],
  },
  {
    id: "general",
    label: "General Operational Improvement",
    description: "Any friction that does not fit a specialized template.",
    category: "other",
    guidanceIntro: "Start with the symptom, then ask why until you reach a changeable cause.",
    questions: [
      { id: "symptom", label: "What operational friction are you seeing?", multiline: true },
      { id: "when", label: "When and where does it happen?" },
      { id: "impact", label: "Who is affected and how?", multiline: true },
    ],
    recommendedAnalyses: ["root_cause_5_whys", "fishbone", "lean_waste"],
    suggestedMetrics: ["Time", "Cost", "Labor hours", "Customer satisfaction"],
  },
];

export function getImprovementTemplate(id: ImprovementTemplateId | string | null | undefined): ImprovementTemplateDef | undefined {
  if (!id) return undefined;
  return IMPROVEMENT_TEMPLATES.find((t) => t.id === id);
}

export function buildFrameworkFromTemplate(
  templateId: ImprovementTemplateId,
  answers: Record<string, string>,
  prioritization?: { impact: number; effort: number; risk: number },
) {
  const template = getImprovementTemplate(templateId);
  if (!template) return { template_id: templateId, template_answers: answers };
  return {
    template_id: templateId,
    template_answers: answers,
    recommended_analyses: template.recommendedAnalyses,
    suggested_metrics: template.suggestedMetrics,
    prioritization: prioritization
      ? {
          impact: prioritization.impact,
          effort: prioritization.effort,
          risk: prioritization.risk,
        }
      : undefined,
  };
}

export function seedScorecardFromTemplate(templateId: ImprovementTemplateId) {
  const template = getImprovementTemplate(templateId);
  if (!template) return [];
  return template.suggestedMetrics.map((label, i) => ({
    id: `metric-${i}`,
    label,
    metric_key: label.toLowerCase().replace(/\s+/g, "_"),
    baseline: "",
    target: "",
    actual: "",
    unit: "",
  }));
}
