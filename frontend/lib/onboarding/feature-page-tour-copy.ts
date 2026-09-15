/**
 * Per-module copy for in-page feature tours (header / toolbar / workspace).
 * Keys match master feature registry / sidebar `item.key`.
 */
export type FeaturePageTourCopy = {
  welcomeSubtitle?: string;
  headerDescription?: string;
  actionsDescription?: string;
  toolbarDescription?: string;
  workspaceDescription?: string;
  /** When true, tour includes a toolbar step (skipped automatically if the anchor is missing). */
  includeToolbar?: boolean;
};

const FEATURE_PAGE_TOUR_COPY: Partial<Record<string, FeaturePageTourCopy>> = {
  daily_planner: {
    welcomeSubtitle:
      "We'll highlight each control on Today: the hour calendar, sidebar cards, and the buttons that reshape the day.",
  },
  ops_facilities: {
    welcomeSubtitle: "Add a building, search the list, then open it to see linked assets and inventory.",
  },
  equipment: {
    welcomeSubtitle: "Overview counts, add an asset, then filter the registry by status or facility.",
  },
  work_requests: {
    welcomeSubtitle: "Log a request, switch My work / Approval / All, then filter and open a row.",
  },
  logs_inspections: {
    welcomeSubtitle: "New inspection sheet, switch Inspections / Logs / Archive, then run a checklist.",
  },
  training_overview: {
    welcomeSubtitle: "KPI tiles first, then the alerts that block a shift.",
  },
  training_flashcards: {
    welcomeSubtitle: "Open a certification pack, or import one from Manage decks.",
  },
  training_learning: {
    welcomeSubtitle: "Assigned learning first, then the Procedure library tab — that screen has its own SOP walkthrough.",
  },
  procedures: {
    welcomeSubtitle: "Create an SOP, assign it, filter the catalog, then open a card.",
  },
  standards_procedures: {
    welcomeSubtitle: "Create an SOP, assign it, filter the catalog, then open a card.",
  },
  training_compliance: {
    welcomeSubtitle: "Compliance views, KPI tiles, then the qualification matrix.",
  },
  ops_me: {
    welcomeSubtitle: "Profile tabs, then the fields that save when you leave them.",
  },
  daily_planner_inbox: {
    welcomeSubtitle: "Capture work here first. We'll show the form, the list, and how items get onto Today.",
  },
  daily_planner_routine: {
    welcomeSubtitle: "This is the default day shape. We'll walk hours, category targets, and named routine blocks.",
  },
  daily_planner_analytics: {
    welcomeSubtitle: "A record of where time went. We'll show the range, the metrics, and how to export.",
  },
  projects: {
    welcomeSubtitle: "A walkthrough of the Projects hub—title, actions, filters, then the project list.",
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
  monitoring: {
    welcomeSubtitle: "How to read live monitoring for CO₂, pools, and system health.",
    workspaceDescription:
      "Tank levels and live readings show what is in range, trending, and what needs immediate attention.",
  },
  inventory: {
    welcomeSubtitle: "Sections, filters (including facility when present), the item list, and Register item.",
  },
  standards_routines: {
    welcomeSubtitle: "Routine templates, daily assignments, and shift handoffs.",
    workspaceDescription: "Configure routines, assign them to shifts, and review handoff notes day to day.",
  },
  xplor_indesign: {
    welcomeSubtitle: "Export tagged facility schedules into InDesign-ready layouts.",
    workspaceDescription:
      "This is the Xplor → InDesign pipeline. It helps expedite publication by reducing manual editing.",
  },
  messaging: {
    welcomeSubtitle: "Operational inbox and administrator product feedback.",
    toolbarDescription:
      "Switch between your operational Inbox and Product feedback. Unread feedback counts appear on the tab badge.",
    workspaceDescription:
      "Operational alerts list here with actions to open the related screen or dismiss. Admins manage product feedback in the other tab.",
    includeToolbar: true,
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
    welcomeSubtitle: "Infrastructure maps and operational layers on facility drawings.",
    workspaceDescription: "Draw zones, place devices, and publish layers used across monitoring and scheduling.",
  },
  spatial_infrastructure: {
    welcomeSubtitle: "Infrastructure maps and operational layers on facility drawings.",
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
  ops_regulations: {
    welcomeSubtitle: "New card, search, topic chips, then open a card for the official source.",
    headerDescription: "Search and filter by topic. Company admins can add a card or open one to edit every field, the same way Procedures work.",
    toolbarDescription: "The disclaimer stays visible so summaries are never mistaken for a legal determination.",
    workspaceDescription: "Open a card to read or edit applicability, official URL, verification, Pulse pointers, then save. Archive hides a card without deleting it.",
    includeToolbar: true,
  },
};

const DEFAULT_WORKSPACE =
  "This is the main work area—lists, boards, charts, and editors update here as you work.";

export function featurePageTourCopy(featureKey: string, label: string): FeaturePageTourCopy {
  const custom = FEATURE_PAGE_TOUR_COPY[featureKey];
  if (custom) return custom;
  return {
    welcomeSubtitle: `We'll highlight the title, primary buttons, and filters on ${label}.`,
    workspaceDescription: DEFAULT_WORKSPACE,
  };
}
