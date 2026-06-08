import type { OperationalImprovementAnalysisType } from "@/lib/operational-improvements/types";
import { emptyValueStreamStep } from "@/lib/operational-improvements/value-stream";

export const LEAN_WASTE_TYPES = [
  { key: "waiting", label: "Waiting" },
  { key: "transportation", label: "Transportation" },
  { key: "motion", label: "Motion" },
  { key: "inventory", label: "Inventory" },
  { key: "overproduction", label: "Overproduction" },
  { key: "overprocessing", label: "Overprocessing" },
  { key: "defects", label: "Defects" },
  { key: "unused_talent", label: "Unused talent" },
] as const;

export const FISHBONE_CATEGORIES = [
  "people",
  "process",
  "equipment",
  "materials",
  "environment",
  "management",
] as const;

export function defaultAnalysisData(type: OperationalImprovementAnalysisType): Record<string, unknown> {
  switch (type) {
    case "root_cause_5_whys":
      return {
        problem_statement: "",
        whys: ["", "", "", "", ""],
        root_cause: "",
        contributing_factors: "",
        lessons_learned: "",
      };
    case "fishbone":
      return {
        problem_statement: "",
        categories: Object.fromEntries(FISHBONE_CATEGORIES.map((c) => [c, [] as string[]])),
      };
    case "lean_waste":
      return { wastes: [] as Array<Record<string, string>> };
    case "value_stream_map":
      return { current: { map_type: "current", steps: [emptyValueStreamStep()] }, future: { map_type: "future", steps: [emptyValueStreamStep()] } };
    case "process_analysis":
      return { current_state: "", future_state: "", bottlenecks: "", waste_identified: "" };
    default:
      return {};
  }
}
