import { MASTER_FEATURES } from "@/config/platform/master-feature-registry";
import {
  PERMISSION_MATRIX_DEPARTMENT_LABEL,
  type PermissionMatrixDepartment,
} from "@/config/platform/permission-matrix";
import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { DASHBOARD_TOUR_STEPS } from "@/lib/onboarding/tour-steps/dashboard";
import { standardFeatureTourSteps } from "@/lib/onboarding/tour-steps/shared";

export type ProductTourDef = {
  id: string;
  /** Exact paths (no query) or prefix match when `pathPrefix` is true. */
  paths: readonly string[];
  pathPrefix?: boolean;
  welcomeTitle: string;
  welcomeSubtitle: string;
  welcomeEmoji?: string;
  steps: TourStep[];
};

function normalizePath(path: string): string {
  const base = path.split("?")[0] ?? path;
  if (base.endsWith("/") && base.length > 1) return base.slice(0, -1);
  return base;
}

type TourCopyOverride = {
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  welcomeEmoji?: string;
  headerDescription?: string;
  workspaceDescription?: string;
  toolbarDescription?: string;
  includeToolbar?: boolean;
  extraSteps?: TourStep[];
};

const TOUR_COPY_OVERRIDES: Partial<Record<string, TourCopyOverride>> = {
  monitoring: {
    welcomeEmoji: "📡",
    workspaceDescription:
      "CO₂ tank levels and pool controller cards live here. Watch for out-of-range chemistry and feeder status before issues escalate.",
  },
  schedule: {
    welcomeEmoji: "📅",
    includeToolbar: true,
    toolbarDescription:
      "Move between weeks, switch departments, and open coverage or availability tools from the schedule toolbar.",
    workspaceDescription:
      "The grid is your live plan—drag shifts, review conflicts, and publish when the week is ready.",
  },
  projects: {
    includeToolbar: true,
    workspaceDescription: "Browse active projects, timelines, and ownership from this workspace.",
  },
  project_management: {
    includeToolbar: true,
    workspaceDescription: "Track PM tasks, dependencies, and delivery milestones across projects.",
  },
  inventory: {
    workspaceDescription: "Review stock levels, locations, and reorder signals for consumables and parts.",
  },
  equipment: {
    workspaceDescription: "Find assets, maintenance history, and assignment details for facility equipment.",
  },
  work_requests: {
    workspaceDescription: "Triage new requests, assign work, and follow status through completion.",
  },
  logs_inspections: {
    workspaceDescription: "Run inspections, capture logs, and review compliance history by area.",
  },
  standards_routines: {
    workspaceDescription: "Build routine templates, assign daily work, and review handoff notes on shift.",
  },
  messaging: {
    workspaceDescription: "Operational inbox for alerts plus product feedback your administrators review.",
  },
  training_overview: {
    workspaceDescription: "Summary cards for certifications, expiring training, and compliance risk.",
  },
  training_learning: {
    workspaceDescription: "Assign procedures, track acknowledgments, and manage learning paths.",
  },
  training_compliance: {
    workspaceDescription: "Drill into the training matrix, expirations, and worker qualification gaps.",
  },
  workforce_hub: {
    welcomeTitle: "Team Management",
    workspaceDescription: "Hub for hiring, development, recognition, and workforce planning modules.",
  },
  drawings: {
    workspaceDescription: "Spatial editor for facility maps, layers, and operational overlays.",
  },
  live_map: {
    workspaceDescription: "Live presence and zone activity across the facility in real time.",
  },
  zones_devices: {
    workspaceDescription: "Configure zones, devices, and how they connect to monitoring and maps.",
  },
  settings: {
    workspaceDescription: "Organization preferences, integrations, and module configuration.",
  },
  permissions: {
    workspaceDescription: "Manage roles, feature access, and who can see each module.",
  },
};

function featureTourFromMaster(
  key: string,
  label: string,
  route: string,
  override?: TourCopyOverride,
): ProductTourDef {
  const path = normalizePath(route);
  return {
    id: key,
    paths: [path],
    welcomeTitle: override?.welcomeTitle ?? label,
    welcomeSubtitle:
      override?.welcomeSubtitle ??
      `A quick walkthrough of ${label}—how the page is laid out and where to find the essentials.`,
    welcomeEmoji: override?.welcomeEmoji ?? "✨",
    steps: [
      ...(override?.extraSteps ?? []),
      ...standardFeatureTourSteps(override?.welcomeTitle ?? label, {
        headerDescription: override?.headerDescription,
        workspaceDescription: override?.workspaceDescription,
        toolbarDescription: override?.toolbarDescription,
        includeToolbar: override?.includeToolbar,
      }),
    ],
  };
}

const DASHBOARD_OVERVIEW_TOUR: ProductTourDef = {
  id: "dashboard-overview",
  paths: ["/overview"],
  welcomeTitle: "Welcome to Panorama REC",
  welcomeSubtitle:
    "Let's tour your leadership dashboard—widgets, workforce, monitoring, and navigation.",
  welcomeEmoji: "🏊",
  steps: DASHBOARD_TOUR_STEPS,
};

const DASHBOARD_WORKER_TOUR: ProductTourDef = {
  id: "dashboard-worker",
  paths: ["/worker"],
  welcomeTitle: "Operations dashboard",
  welcomeSubtitle:
    "Your personal operations view uses the same widgets—here's how to read the floor at a glance.",
  welcomeEmoji: "🏊",
  steps: DASHBOARD_TOUR_STEPS,
};

const DEPARTMENT_DASHBOARD_TOUR: ProductTourDef = {
  id: "dashboard-department",
  paths: ["/dashboard/department"],
  pathPrefix: true,
  welcomeTitle: "Department dashboard",
  welcomeSubtitle: "A focused widget canvas for this department—customize layout to match how the team works.",
  welcomeEmoji: "📊",
  steps: standardFeatureTourSteps("Department dashboard", {
    headerDescription: "This dashboard belongs to one department. Use edit mode to add widgets your role can access.",
    workspaceDescription:
      "Arrange KPIs, workforce, and operational widgets for daily standups. Layout is saved per user.",
  }),
};

function buildMasterFeatureTours(): ProductTourDef[] {
  const claimed = new Set(["/overview", "/worker", "/dashboard/department"]);
  const tours: ProductTourDef[] = [];

  for (const f of MASTER_FEATURES) {
    if (!f.navVisible) continue;
    const path = normalizePath(f.route);
    if (claimed.has(path)) continue;
    if (path.startsWith("/dashboard/department")) continue;
    claimed.add(path);
    const override = TOUR_COPY_OVERRIDES[f.key];
    tours.push(featureTourFromMaster(f.key, f.label, f.route, override));
  }

  return tours;
}

export const PRODUCT_TOURS: readonly ProductTourDef[] = [
  DASHBOARD_OVERVIEW_TOUR,
  DASHBOARD_WORKER_TOUR,
  DEPARTMENT_DASHBOARD_TOUR,
  ...buildMasterFeatureTours(),
];

function pathMatchesTour(pathname: string, tour: ProductTourDef): boolean {
  const normalized = normalizePath(pathname);
  for (const p of tour.paths) {
    if (tour.pathPrefix) {
      if (normalized === p || normalized.startsWith(`${p}/`)) return true;
    } else if (normalized === p) {
      return true;
    }
  }
  return false;
}

function departmentTourTitle(pathname: string): string {
  const slug = pathname.split("/")[3] ?? "";
  const label = PERMISSION_MATRIX_DEPARTMENT_LABEL[slug as PermissionMatrixDepartment];
  return label ? `${label} dashboard` : "Department dashboard";
}

export function resolveProductTour(pathname: string): ProductTourDef | null {
  const normalized = normalizePath(pathname);
  let best: ProductTourDef | null = null;
  let bestScore = -1;

  for (const tour of PRODUCT_TOURS) {
    if (!pathMatchesTour(normalized, tour)) continue;
    const score = Math.max(...tour.paths.map((p) => (tour.pathPrefix ? p.length + 50 : p.length)));
    if (score > bestScore) {
      best = tour;
      bestScore = score;
    }
  }

  if (best?.id === "dashboard-department") {
    return {
      ...best,
      welcomeTitle: departmentTourTitle(normalized),
      steps: standardFeatureTourSteps(departmentTourTitle(normalized), {
        headerDescription: "A department-scoped dashboard with widgets tuned for this team's workflows.",
        workspaceDescription:
          "Add and arrange widgets in edit mode. Saved layouts follow you across sessions for this department.",
      }),
    };
  }

  return best;
}

export function hasProductTour(pathname: string): boolean {
  return resolveProductTour(pathname) != null;
}
