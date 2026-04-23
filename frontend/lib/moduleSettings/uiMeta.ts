import type { ModuleId } from "./defaults";

export type SettingFieldType = "toggle" | "number" | "json";

export type SettingFieldMeta = {
  key: string;
  type: SettingFieldType;
  label: string;
  description: string;
  /** For json fields: placeholder / hint text */
  placeholder?: string;
};

export type SettingSectionMeta = {
  id: string;
  title: string;
  description?: string;
  fields: SettingFieldMeta[];
};

export const MODULE_SETTINGS_UI: Record<ModuleId, { title: string; sections: SettingSectionMeta[] }> = {
  workRequests: {
    title: "Work requests & work orders",
    sections: [
      {
        id: "general",
        title: "General",
        fields: [
          {
            key: "enablePriorityLevels",
            type: "toggle",
            label: "Enable priority levels",
            description: "When off, new issues default to medium priority and priority UI can be simplified.",
          },
        ],
      },
      {
        id: "automation",
        title: "Automation",
        fields: [
          {
            key: "autoAssignTechnician",
            type: "toggle",
            label: "Auto-assign creator",
            description: "When on, new work requests assign to the creating user if no assignee is chosen.",
          },
        ],
      },
      {
        id: "completion",
        title: "Completion rules",
        fields: [
          {
            key: "requirePhotoOnClose",
            type: "toggle",
            label: "Require attachment before close",
            description: "Technicians must attach at least one file before marking a work order completed.",
          },
          {
            key: "lockAfterCompletion",
            type: "toggle",
            label: "Lock after completion",
            description: "Prevent reopening a completed work order except for roles allowed below.",
          },
          {
            key: "allowManualOverride",
            type: "toggle",
            label: "Managers may reopen",
            description: "When locking is on, supervisors and managers can still move status off completed.",
          },
        ],
      },
    ],
  },
  schedule: {
    title: "Scheduling",
    sections: [
      {
        id: "facilities",
        title: "Facilities (schedule)",
        description:
          "How many physical sites or buildings appear on the workforce schedule. (Equipment and drawings still use the separate Zones & Devices system.)",
        fields: [
          {
            key: "facilityCount",
            type: "number",
            label: "Number of facilities to track (1–20)",
            description: "Saves a matching list of places schedulers can assign to each shift. You can name them in the list below.",
          },
          {
            key: "facilityLabels",
            type: "json",
            label: "Custom facility names (optional JSON array of strings)",
            description:
              'e.g. ["Pool","Arena","Curling Rink"] — if shorter than the number above, remaining names default to "Facility 2", etc.',
            placeholder: '["Pool", "Rink 1", "Gym"]',
          },
        ],
      },
      {
        id: "general",
        title: "General",
        fields: [
          {
            key: "allowShiftOverrides",
            type: "toggle",
            label: "Allow shift drag & delete",
            description: "When off, the calendar is read-only for shift moves and deletes (view-only scheduling).",
          },
          {
            key: "autoGenerateShifts",
            type: "toggle",
            label: "Show auto-generate hints",
            description: "Reserved for future bulk generation; keeps the option visible for admins.",
          },
          {
            key: "enableNightAssignments",
            type: "toggle",
            label: "Enable night assignments panel",
            description: "Adds an Assignments tab in the Day view for tracking areas and notes for night shift.",
          },
        ],
      },
      {
        id: "rules",
        title: "Hours & limits",
        fields: [
          {
            key: "enforceMaxHours",
            type: "number",
            label: "Max hours per week (0 = off)",
            description: "When greater than zero, adding or moving shifts warns if a worker exceeds this many hours per calendar week.",
          },
        ],
      },
      {
        id: "coverage",
        title: "Coverage rules",
        description: "Custom staffing requirements (validated against the schedule; does not auto-assign).",
        fields: [
          {
            key: "coverageRules",
            type: "json",
            label: "Coverage rules (advanced)",
            description:
              "Create rules to require certifications or counts per shift type. If you prefer, leave this empty and use the builder in the Schedule UI (coming next).",
            placeholder: JSON.stringify(
              [
                {
                  id: "rule-1",
                  kind: "cert_per_shift_type",
                  certification: "RO",
                  minCount: 1,
                  shiftTypes: ["day", "afternoon", "night"],
                },
              ],
              null,
              2,
            ),
          },
        ],
      },
    ],
  },
  assets: {
    title: "Assets & equipment",
    sections: [
      {
        id: "general",
        title: "General",
        fields: [
          {
            key: "requireSerialNumber",
            type: "toggle",
            label: "Require serial number",
            description: "Equipment records must include a serial number before they can be saved.",
          },
          {
            key: "enableMaintenanceHistory",
            type: "toggle",
            label: "Show maintenance history",
            description: "Surface service dates and maintenance context in the equipment UI.",
          },
          {
            key: "allowAssetHierarchy",
            type: "toggle",
            label: "Allow asset grouping",
            description: "Reserved for nested asset relationships; informs future hierarchy features.",
          },
        ],
      },
    ],
  },
  blueprint: {
    title: "Blueprint designer",
    sections: [
      {
        id: "canvas",
        title: "Canvas",
        fields: [
          {
            key: "showGrid",
            type: "toggle",
            label: "Show grid",
            description: "Display the background grid on the floor plan canvas.",
          },
          {
            key: "enableSnapping",
            type: "toggle",
            label: "Enable snapping",
            description: "Snap zones and shapes to nearby edges and grid when drawing or dragging.",
          },
          {
            key: "enableAutoConnect",
            type: "toggle",
            label: "Smart connection routing",
            description: "Use orthogonal routing hints when linking devices and symbols (when supported).",
          },
        ],
      },
    ],
  },
  compliance: {
    title: "Compliance",
    sections: [
      {
        id: "escalation",
        title: "Escalation",
        fields: [
          {
            key: "requireManagerForEscalation",
            type: "toggle",
            label: "Managers only for flags",
            description: "Only managers and above can flag or unflag compliance records.",
          },
        ],
      },
      {
        id: "display",
        title: "Display",
        fields: [
          {
            key: "showRepeatOffenderHighlight",
            type: "toggle",
            label: "Highlight repeat offenders",
            description: "Show repeat-offender badges and accents in the compliance table.",
          },
          {
            key: "strictReviewDeadlines",
            type: "toggle",
            label: "Strict review messaging",
            description: "Show stronger copy for overdue reviews (UI emphasis only).",
          },
        ],
      },
    ],
  },
};
