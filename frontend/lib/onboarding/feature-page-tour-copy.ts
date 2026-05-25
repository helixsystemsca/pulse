/**
 * Per-module copy for in-page feature tours (header / toolbar / workspace).
 * Keys match master feature registry / sidebar `item.key`.
 */
export type FeaturePageTourCopy = {
  welcomeSubtitle?: string;
  headerDescription?: string;
  toolbarDescription?: string;
  workspaceDescription?: string;
  /** When true, tour includes a toolbar step (skipped automatically if the anchor is missing). */
  includeToolbar?: boolean;
};

const FEATURE_PAGE_TOUR_COPY: Partial<Record<string, FeaturePageTourCopy>> = {
  projects: {
    welcomeSubtitle: "A quick walkthrough of the Projects hub—filters, actions, and your project list.",
    headerDescription:
      "The page title and primary actions live here—create projects, add categories, and jump into delivery work.",
    toolbarDescription:
      "Filter the list by Active, Future, Completed, or Archive. Timing rules decide which bucket a project appears in.",
    workspaceDescription:
      "Project cards show status, dates, and staffing signals. Open a project for tasks, Gantt views, and schedule overlays.",
    includeToolbar: true,
  },
  project_management: {
    welcomeSubtitle: "How the Project Management workspace is organized for timelines and delivery.",
    headerDescription: "Track cross-project timelines, dependencies, and PM workflows from this header.",
    workspaceDescription: "The main canvas holds schedules, milestones, and project health at a glance.",
  },
  schedule: {
    welcomeSubtitle: "Tour the scheduling grid—toolbar controls and the shift workspace.",
    headerDescription: "This is your weekly staffing command center. The header shows the period you are editing.",
    toolbarDescription:
      "Navigate weeks, switch views, filter workers, and run publish or layout actions without leaving the grid.",
    workspaceDescription:
      "Drag workers and shift codes onto the grid. Conflicts, certifications, and recurring templates surface inline.",
    includeToolbar: true,
  },
  schedule_availability: {
    welcomeSubtitle: "How to collect and review staff availability before building the schedule.",
    workspaceDescription: "Review submitted windows, gaps, and worker responses before you assign shifts.",
  },
  schedule_coverage: {
    welcomeSubtitle: "Read coverage heatmaps to spot understaffed zones and bands.",
    workspaceDescription: "Charts and tables highlight where coverage drops below targets by day and shift type.",
  },
  schedule_shift_definitions: {
    welcomeSubtitle: "Manage standard shift templates and codes used on the scheduling grid.",
    workspaceDescription: "Define start/end times, labels, and bands so palette drops stay consistent.",
  },
  work_requests: {
    welcomeSubtitle: "Walk through the work request queue from intake to completion.",
    headerDescription: "Track maintenance and service requests—status, assignee, and priority show in the header KPIs.",
    workspaceDescription: "Filter and open requests, update status, and link assets or zones from the main list or board.",
  },
  monitoring: {
    welcomeSubtitle: "How to read live monitoring for CO₂, pools, and system health.",
    workspaceDescription: "Widgets call out what is in range, trending, and what needs immediate attention.",
  },
  logs_inspections: {
    welcomeSubtitle: "Inspection checklists, compliance logs, and audit history on one page.",
    workspaceDescription: "Start inspections, record results, and review historical entries from the workspace.",
  },
  inventory: {
    welcomeSubtitle: "Stock levels, locations, and reorder signals in the inventory workspace.",
    workspaceDescription: "Browse items, adjust quantities, and act on low-stock alerts in the main table or cards.",
  },
  equipment: {
    welcomeSubtitle: "Asset registry, maintenance history, and assignments.",
    workspaceDescription: "Locate equipment, open maintenance records, and tie assets to work requests.",
  },
  training_overview: {
    welcomeSubtitle: "Training KPIs—certifications, expirations, and compliance risk.",
    workspaceDescription: "Summary tiles and charts show org-wide training health before you drill into matrices.",
  },
  training_learning: {
    welcomeSubtitle: "Procedures, acknowledgments, and learning assignments for your role.",
    workspaceDescription: "Open learning paths, assigned procedures, and completion status from this workspace.",
  },
  training_compliance: {
    welcomeSubtitle: "Qualification matrix, gaps, and expiring credentials.",
    workspaceDescription: "The matrix is the source of truth for who is current on each required procedure.",
  },
  standards_routines: {
    welcomeSubtitle: "Routine templates, daily assignments, and shift handoffs.",
    workspaceDescription: "Configure routines, assign them to shifts, and review handoff notes day to day.",
  },
  messaging: {
    welcomeSubtitle: "Operational inbox and administrator product feedback.",
    workspaceDescription: "Read operational alerts and, for admins, product feedback submitted from the header.",
  },
  workforce_hub: {
    welcomeSubtitle: "Entry point for hiring, development, recognition, and planning.",
    workspaceDescription: "Choose a workforce program to open—each tile links to a dedicated flow.",
  },
  zones_devices: {
    welcomeSubtitle: "Zones, devices, and how they connect to maps and monitoring.",
    workspaceDescription: "Manage zone hierarchy, device assignments, and linkage to spatial views.",
  },
  drawings: {
    welcomeSubtitle: "Spatial editor for facility maps and operational layers.",
    workspaceDescription: "Draw zones, place devices, and publish layers used across monitoring and scheduling.",
  },
  live_map: {
    welcomeSubtitle: "Real-time presence and activity across the facility.",
    workspaceDescription: "The map highlights where work is happening and which zones need attention.",
  },
  permissions: {
    welcomeSubtitle: "Roles, feature access, and who can open each module.",
    workspaceDescription: "Adjust role matrices, department access, and worker permissions from this workspace.",
  },
  settings: {
    welcomeSubtitle: "Organization settings, integrations, and preferences.",
    workspaceDescription: "Configure tenant-wide options—the sections on this page group related admin controls.",
  },
};

const DEFAULT_WORKSPACE =
  "This is the main work area—lists, boards, charts, and editors update here as you work.";

export function featurePageTourCopy(featureKey: string, label: string): FeaturePageTourCopy {
  const custom = FEATURE_PAGE_TOUR_COPY[featureKey];
  if (custom) return custom;
  return {
    welcomeSubtitle: `A quick tour of the ${label} page—header, tools, and main workspace.`,
    headerDescription: `${label} is where your team runs this workflow. The header shows where you are and surfaces primary actions.`,
    workspaceDescription: DEFAULT_WORKSPACE,
  };
}
