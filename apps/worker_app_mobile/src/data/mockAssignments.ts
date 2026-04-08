import type { FieldTask } from "@/types/models";

export const MOCK_ASSIGNMENTS: FieldTask[] = [
  {
    id: "t1",
    title: "Inspect north pump manifold",
    description:
      "Visual inspection, torque check on flange bolts, log pressures in CMMS. Escalate if vibration exceeds baseline.",
    locationLabel: "Boiler Room · Zone B",
    priority: "high",
    status: "pending",
    dueTime: "10:00",
  },
  {
    id: "t2",
    title: "Replace pool deck sensor battery",
    description: "LR44 kit in van. Confirm telemetry after swap.",
    locationLabel: "Aquatics · Deck west",
    priority: "medium",
    status: "in_progress",
    dueTime: "13:30",
  },
  {
    id: "t3",
    title: "Weekly fire extinguisher walk",
    description: "Tags, seals, accessibility. Photo any deficiencies.",
    locationLabel: "All public floors",
    priority: "low",
    status: "pending",
  },
  {
    id: "t4",
    title: "Respond: guest equipment lockout",
    description: "Badge reader intermittent. Test reader and network drop.",
    locationLabel: "Garage L1",
    priority: "critical",
    status: "paused",
    dueTime: "Now",
  },
];
