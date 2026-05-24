/** Placeholder operational metrics for Team Management domain pages. */

export type WorkforceMetric = {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "positive" | "caution" | "accent";
};

export const WORKFORCE_HUB_HERO_METRICS: WorkforceMetric[] = [
  { id: "readiness", label: "Workforce readiness", value: "92%", hint: "Shifts covered · certs current", tone: "positive" },
  { id: "training", label: "Training coverage", value: "88%", hint: "Matrix slots up to date", tone: "accent" },
  { id: "hiring", label: "Open hiring pipeline", value: "4", hint: "Active candidates in process", tone: "neutral" },
  { id: "cross", label: "Cross-training", value: "6", hint: "Roles with backup coverage", tone: "positive" },
];

export const WORKFORCE_HUB_SUPPORT_METRICS: WorkforceMetric[] = [
  { id: "certs", label: "Upcoming certifications", value: "11", hint: "Next 30 days", tone: "caution" },
  { id: "dev", label: "Development activity", value: "18", hint: "Active growth plans", tone: "accent" },
  { id: "risks", label: "Staffing risks", value: "2", hint: "Succession gaps flagged", tone: "caution" },
  { id: "recognition", label: "Recognition", value: "7", hint: "Shoutouts this month", tone: "positive" },
  { id: "coordination", label: "Coordination follow-ups", value: "5", hint: "Open leadership items", tone: "neutral" },
];

export type WorkforcePlaceholderCard = {
  id: string;
  title: string;
  description: string;
  items?: string[];
};

export const TEAM_INSIGHTS_CARDS: WorkforcePlaceholderCard[] = [
  { id: "training", title: "Training coverage", description: "Matrix completion and expiring credentials.", items: ["88% current", "6 expiring in 30d", "2 gaps in aquatics"] },
  { id: "readiness", title: "Staffing readiness", description: "Shift coverage vs demand for the next two weeks.", items: ["Thu PM: 1 gap", "Weekend: fully staffed"] },
  { id: "reliability", title: "Reliability trends", description: "Attendance and handoff consistency (supportive view).", items: ["On-time check-in 94%", "Handoff notes 91% complete"] },
  { id: "cross", title: "Cross-training matrix", description: "Backup coverage by role and zone.", items: ["6 roles with backup", "2 single-point skills"] },
  { id: "gaps", title: "Operational gaps", description: "Skills or coverage holes affecting continuity.", items: ["Chemical room — weekend", "Lead coverage — PTO week"] },
  { id: "risks", title: "Workforce risks", description: "Proactive flags for leadership review.", items: ["Succession: front desk lead", "Cert renewal cluster — March"] },
  { id: "mentorship", title: "Mentorship participation", description: "Pairings and touchpoints this quarter.", items: ["12 active pairings", "4 new this month"] },
  { id: "engagement", title: "Engagement indicators", description: "Participation in development and recognition.", items: ["Development plans: 18 active", "Peer shoutouts: 7 this month"] },
];

export const HIRING_PIPELINE_STAGES = [
  { stage: "Applied", count: 6, note: "Resume + availability screen" },
  { stage: "Phone screen", count: 3, note: "Communication & coachability" },
  { stage: "Working interview", count: 2, note: "Floor shadow + scenario" },
  { stage: "Offer / onboarding prep", count: 1, note: "Readiness checklist started" },
] as const;

export const DEVELOPMENT_PROFILES = [
  { name: "Jordan Lee", focus: "Leadership readiness", plan: "Shift lead shadowing · delegation practice", mentor: "Alex Rivera" },
  { name: "Sam Ortiz", focus: "Cross-training — aquatics", plan: "Chemical ops · opening checklist", mentor: "Chris Kim" },
  { name: "Taylor Brooks", focus: "Communication & initiative", plan: "Guest recovery scenarios · peer feedback", mentor: "Jordan Lee" },
] as const;

export const ONBOARDING_TRACKS = [
  { title: "Week 1 — Facility orientation", progress: 100, items: ["Safety tour", "PPE & keys", "Core SOP bundle"] },
  { title: "Week 2 — Role procedures", progress: 72, items: ["Opening checklist", "Chemical room", "Guest recovery"] },
  { title: "Certifications", progress: 45, items: ["Pool operator", "First aid refresh"] },
] as const;

export const RECOGNITION_FEED = [
  { who: "Sam Ortiz", what: "Stepped in for opening chemical check — clear handoff", when: "Yesterday" },
  { who: "Taylor Brooks", what: "Completed pool operator cert ahead of schedule", when: "This week" },
  { who: "Jordan Lee", what: "Mentored two new hires through first weekend shifts", when: "This week" },
] as const;

export const PLANNING_CARDS: WorkforcePlaceholderCard[] = [
  { id: "forecast", title: "Staffing forecasts", description: "Expected demand vs scheduled hours.", items: ["Summer: +12% hours", "School break: coverage plan drafted"] },
  { id: "seasonal", title: "Seasonal staffing prep", description: "Hiring and cross-training timelines.", items: ["Lifeguard surge: Apr 15", "Extra desk coverage: May 1"] },
  { id: "succession", title: "Succession risks", description: "Roles with limited backup depth.", items: ["Front desk lead", "Chemical specialist"] },
  { id: "redundancy", title: "Skill redundancy", description: "Where the team can cover each other.", items: ["Strong: opening/closing", "Thin: racquets desk"] },
  { id: "availability", title: "Availability trends", description: "Patterns affecting scheduling.", items: ["PTO cluster: mid-March", "Student return: higher weekend availability"] },
  { id: "coverage", title: "Coverage maps", description: "Visual staffing by zone and shift band.", items: ["Pool deck: green", "Fitness floor: amber Thu PM"] },
];

export const COORDINATION_ITEMS = [
  { title: "Handoff — chemical delivery delay", owner: "Ops lead", status: "Open", due: "Today" },
  { title: "Recurring: weekend opening checklist gaps", owner: "Supervisor", status: "Watching", due: "This week" },
  { title: "Prep for facility inspection window", owner: "Manager", status: "In progress", due: "Next week" },
  { title: "Follow-up: cross-train front desk backup", owner: "Jordan Lee", status: "Scheduled", due: "Fri" },
] as const;
