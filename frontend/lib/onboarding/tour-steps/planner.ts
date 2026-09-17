import type { TourStep } from "@/lib/onboarding/tour-steps/types";

export const PLANNER_TODAY_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="planner-tabs"]',
    title: "Planner pages",
    description:
      "Today is the calendar. Inbox captures work. Routine is your default hour pattern. Analytics shows where the week actually went.",
    placement: "bottom",
  },
  {
    target: '[data-tour="planner-settings"]',
    title: "Settings",
    description:
      "Set working hours (default 8:30–4:30) and the color for each work category. Colors show on every calendar block.",
    placement: "left",
  },
  {
    target: '[data-tour="planner-emergency"]',
    title: "Emergency / interruption",
    description:
      "Use this when the day breaks. It pauses the current task, records why, can open Emergency Response, and can create a work request without blocking the interruption.",
    placement: "left",
  },
  {
    target: '[data-tour="planner-reset"]',
    title: "Reset hour template",
    description:
      "Rebuilds the day as eight 1-hour blocks from 8:30–4:30. Locked meetings, interruptions, and in-progress work are kept.",
    placement: "left",
  },
  {
    target: '[data-tour="planner-date"]',
    title: "Which day you are editing",
    description: "Step backward or forward, or pick a date. Completions and metrics stay attached to that day.",
    placement: "bottom",
  },
  {
    target: '[data-tour="planner-quick-add"]',
    title: "Add into Open capacity",
    description:
      "Type a title, pick a category, and Add. Pulse splits an Open block to make room. Open is unused capacity, not a full day.",
    placement: "bottom",
  },
  {
    target: '[data-tour="planner-calendar"]',
    title: "Day calendar",
    description:
      "Drag a planned block to move it. Pull the top or bottom edge to resize. Locked meetings and interruptions stay put. Open ranges show + Add block.",
    placement: "right",
  },
  {
    target: '[data-tour="planner-now"]',
    title: "Now",
    description: "Whatever sits on the clock right now. If it is a task, Start / Complete / Defer appear under the calendar.",
    placement: "left",
  },
  {
    target: '[data-tour="planner-next"]',
    title: "Next",
    description: "The following block so you can see what is coming without scanning the whole grid.",
    placement: "left",
  },
  {
    target: '[data-tour="planner-at-risk"]',
    title: "At risk",
    description:
      "Overdue or repeatedly deferred work. This is a warning list, not a score. Open Inbox to capture or unblock it.",
    placement: "left",
  },
  {
    target: '[data-tour="planner-meeting"]',
    title: "Insert a meeting",
    description:
      "Creates an internal calendar event and a locked meeting block. Outlook/Google are not connected. Meetings insert into Open capacity and cannot be dragged.",
    placement: "left",
  },
  {
    target: '[data-tour="planner-closeout"]',
    title: "Daily review",
    description:
      "End-of-day counts: completed planned work, delayed, blocked, interruptions, meetings, and strategic time. Completion % is task/planned work only — Open blocks do not count. Save notes here so Analytics has a record.",
    placement: "left",
  },
];

export const PLANNER_INBOX_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="planner-tabs"]',
    title: "Inbox vs Today",
    description:
      "Inbox is capture. Items you add here can be placed onto Today. The calendar itself is on the Today tab.",
    placement: "bottom",
  },
  {
    target: '[data-tour="planner-email"]',
    title: "Email suggestions",
    description:
      "Labeled when a mailbox is not connected so the panel does not look broken. When a connector exists, candidate tasks appear here for you to accept — never auto-created.",
    placement: "bottom",
  },
  {
    target: '[data-tour="planner-capture"]',
    title: "New task",
    description:
      "Name, category, priority, and estimate. Source can be project, PM, inspection, and similar. Add to inbox stores it. Place on today fits ready tasks onto Open capacity without resetting the day.",
    placement: "top",
  },
  {
    target: '[data-tour="planner-task-list"]',
    title: "Open work",
    description:
      "Search and filter by status. Start, Complete, or Block from the row. Blocked work stays visible so it is not forgotten.",
    placement: "top",
  },
];

export const PLANNER_ROUTINE_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="planner-tabs"]',
    title: "Routine",
    description:
      "This page is the default shape of a workday. Today uses it when you reset the hour template. Changing hours here does not wipe a day you already edited.",
    placement: "bottom",
  },
  {
    target: '[data-tour="planner-hours"]',
    title: "Working hours",
    description:
      "Start and end for the calendar grid. Default is 8:30–4:30. Times snap to 15 minutes. Adaptive estimates (optional) learn from completed actuals.",
    placement: "bottom",
  },
  {
    target: '[data-tour="planner-targets"]',
    title: "Category targets",
    description:
      "How you intend to split attention across operations, maintenance, projects, and the rest. Analytics compares actual time against these later.",
    placement: "top",
  },
  {
    target: '[data-tour="planner-routine-list"]',
    title: "Named routine blocks",
    description:
      "Optional named blocks (for example Email). Protected blocks survive a template reset. Flexible ones can be squeezed when you drag the calendar.",
    placement: "top",
  },
];

export const PLANNER_ANALYTICS_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="planner-tabs"]',
    title: "Analytics",
    description:
      "This is a record of where time went—not a productivity score. It only uses what the planner stored.",
    placement: "bottom",
  },
  {
    target: '[data-tour="planner-range"]',
    title: "Range and export",
    description: "Week, month, quarter, or year. CSV / Excel downloads the same numbers for a report.",
    placement: "left",
  },
  {
    target: '[data-tour="planner-metrics"]',
    title: "Time, delays, interruptions",
    description:
      "Allocation by category, interruption minutes, and delay reasons. Emergency and higher-priority delays are labeled healthy—they are not treated as failure.",
    placement: "top",
  },
  {
    target: '[data-tour="planner-insights"]',
    title: "Insights",
    description:
      "Short observations once there are completions, delays, or interruptions. Comparison vs the previous period appears when enough history exists.",
    placement: "top",
  },
];
