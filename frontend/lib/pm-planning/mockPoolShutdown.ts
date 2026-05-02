import type { PmProjectMeta, PmTask } from "@/lib/pm-planning/types";

/** Demo DAG loosely matching “Pool Shutdown” mockups (IDs T01…). */
export const POOL_SHUTDOWN_META: PmProjectMeta = {
  id: "prj-pool-2025",
  name: "Pool Shutdown",
  code: "PRJ-2025-047",
  projectStart: new Date("2025-06-02T00:00:00"),
};

export const MOCK_PM_TASKS: PmTask[] = [
  { id: "T01", name: "Project Kickoff & Safety Briefing", start: POOL_SHUTDOWN_META.projectStart, duration: 1, dependencies: [], resource: "PM", category: "DECOMMISSION" },
  { id: "T02", name: "Equipment & Chemical Procurement", start: POOL_SHUTDOWN_META.projectStart, duration: 2, dependencies: ["T01"], resource: "Procurement", category: "DECOMMISSION" },
  { id: "T03", name: "Site Fencing & Access Control", start: POOL_SHUTDOWN_META.projectStart, duration: 1, dependencies: ["T01"], resource: "Site Crew", category: "DECOMMISSION" },
  { id: "T04", name: "Drain Pool & Backwash System", start: POOL_SHUTDOWN_META.projectStart, duration: 5, dependencies: ["T02", "T03"], resource: "Plumbing", category: "DECOMMISSION" },
  { id: "T05", name: "Chemical Neutralization", start: POOL_SHUTDOWN_META.projectStart, duration: 1, dependencies: ["T04"], resource: "Chemical", category: "DECOMMISSION" },
  { id: "T06", name: "Remove Pool Equipment", start: POOL_SHUTDOWN_META.projectStart, duration: 1, dependencies: ["T04"], resource: "Mechanical", category: "DECOMMISSION" },
  { id: "T07", name: "Surface Inspection & Assessment", start: POOL_SHUTDOWN_META.projectStart, duration: 1, dependencies: ["T05"], resource: "Inspector", category: "INSPECTION" },
  { id: "T08", name: "Structural Crack Mapping", start: POOL_SHUTDOWN_META.projectStart, duration: 1, dependencies: ["T07"], resource: "Inspector", category: "INSPECTION" },
  { id: "T09", name: "Tile & Coping Removal", start: POOL_SHUTDOWN_META.projectStart, duration: 2, dependencies: ["T08"], resource: "Tile Crew", category: "DEMOLITION" },
  { id: "T10", name: "Plaster / Finish Removal", start: POOL_SHUTDOWN_META.projectStart, duration: 2, dependencies: ["T08"], resource: "Plaster Crew", category: "DEMOLITION" },
  { id: "T11", name: "Structural Crack Repair", start: POOL_SHUTDOWN_META.projectStart, duration: 5, dependencies: ["T09", "T10", "T06"], resource: "Structural", category: "REPAIR" },
  { id: "T12", name: "Surface Prep & Bond Coat", start: POOL_SHUTDOWN_META.projectStart, duration: 2, dependencies: ["T11"], resource: "Tile Crew", category: "RESURFACE" },
  { id: "T13", name: "New Tile & Coping Install", start: POOL_SHUTDOWN_META.projectStart, duration: 3, dependencies: ["T12"], resource: "Tile Crew", category: "RESURFACE" },
  { id: "T14", name: "Plaster / Marcite Application", start: POOL_SHUTDOWN_META.projectStart, duration: 3, dependencies: ["T13"], resource: "Plaster Crew", category: "RESURFACE" },
  { id: "T15", name: "Fill & Chemical Startup", start: POOL_SHUTDOWN_META.projectStart, duration: 2, dependencies: ["T14"], resource: "Chemical", category: "RECOMMISSION" },
  { id: "T16", name: "Equipment Reinstall & QA", start: POOL_SHUTDOWN_META.projectStart, duration: 2, dependencies: ["T15"], resource: "Mechanical", category: "RECOMMISSION" },
  { id: "T17", name: "Electrical & Controls Check", start: POOL_SHUTDOWN_META.projectStart, duration: 1, dependencies: ["T16"], resource: "Electrical", category: "RECOMMISSION" },
  { id: "T18", name: "Water Quality Verification", start: POOL_SHUTDOWN_META.projectStart, duration: 1, dependencies: ["T17"], resource: "Inspector", category: "CLOSEOUT" },
  { id: "T19", name: "Safety Walkdown & Sign-off", start: POOL_SHUTDOWN_META.projectStart, duration: 1, dependencies: ["T18"], resource: "PM", category: "CLOSEOUT" },
  { id: "T20", name: "Handover & Documentation", start: POOL_SHUTDOWN_META.projectStart, duration: 1, dependencies: ["T19"], resource: "PM", category: "CLOSEOUT" },
];
