import type { ProjectSummary } from "@/types/models";

export const MOCK_PROJECTS: ProjectSummary[] = [
  { id: "p1", name: "Aquatics sensor refresh", progressPct: 62, statusLabel: "In progress" },
  { id: "p2", name: "Boiler efficiency upgrade", progressPct: 28, statusLabel: "Planning" },
  { id: "p3", name: "Wayfinding LED retrofit", progressPct: 88, statusLabel: "Punch list" },
];
