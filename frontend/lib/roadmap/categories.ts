import type { RoadmapCategory } from "@/lib/roadmap/types";

export const ROADMAP_CATEGORIES: readonly {
  id: RoadmapCategory;
  label: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  { id: "facilities", label: "Facilities", color: "#2563eb", bg: "bg-blue-500/15", border: "border-blue-500/40" },
  { id: "asset_management", label: "Asset Management", color: "#16a34a", bg: "bg-emerald-500/15", border: "border-emerald-500/40" },
  { id: "projects", label: "Projects", color: "#ea580c", bg: "bg-orange-500/15", border: "border-orange-500/40" },
  { id: "safety", label: "Safety", color: "#dc2626", bg: "bg-red-500/15", border: "border-red-500/40" },
  { id: "training", label: "Training", color: "#9333ea", bg: "bg-violet-500/15", border: "border-violet-500/40" },
  { id: "operations", label: "Operations", color: "#0d9488", bg: "bg-teal-500/15", border: "border-teal-500/40" },
  { id: "administration", label: "Administration", color: "#6b7280", bg: "bg-slate-500/15", border: "border-slate-500/40" },
] as const;

const byId = new Map(ROADMAP_CATEGORIES.map((c) => [c.id, c]));

export function roadmapCategoryMeta(category: string) {
  return byId.get(category as RoadmapCategory) ?? ROADMAP_CATEGORIES[2];
}

export const ROADMAP_PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
] as const;

export const ROADMAP_STATUSES = [
  { id: "planned", label: "Planned" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "on_hold", label: "On hold" },
  { id: "cancelled", label: "Cancelled" },
] as const;

export const QUARTER_THEMES = [
  { q: 1, label: "PLAN", subtitle: "Planning & Foundations", tint: "bg-blue-500/[0.06]", accent: "text-blue-600" },
  { q: 2, label: "BUILD", subtitle: "Implementation & Execution", tint: "bg-emerald-500/[0.06]", accent: "text-emerald-600" },
  { q: 3, label: "OPTIMIZE", subtitle: "Continuous Improvement", tint: "bg-amber-500/[0.06]", accent: "text-amber-600" },
  { q: 4, label: "REVIEW", subtitle: "Reporting & Lessons Learned", tint: "bg-orange-500/[0.06]", accent: "text-orange-600" },
] as const;
