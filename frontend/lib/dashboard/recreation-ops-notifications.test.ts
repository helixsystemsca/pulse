import { describe, expect, it } from "vitest";
import { operationalNotificationHref } from "@/lib/dashboard/operational-notifications";
import { recreationOpsNotificationItems } from "@/lib/dashboard/recreation-ops-notifications";
import type { OpsCommandDashboard } from "@/lib/recreation/commandService";

const emptyDash = (): OpsCommandDashboard => ({
  checklist_due_today: 0,
  checklist_overdue: 0,
  checklist_open_items: 0,
  active_checklists: 0,
  knowledge_gaps_open: 0,
  knowledge_gaps_high: 0,
  authority_unknown: 0,
  profile_complete: true,
  open_team_risks: 0,
  people_count: 0,
  assets_needing_attention: 0,
  inventory_low_stock: 0,
  training_overdue: 0,
  compliance_missed: 0,
  critical_procedures: 0,
  emergency_readiness_gaps: 0,
  active_projects: 0,
  overdue_project_tasks: 0,
  roadmap_behind: 0,
  pm_coord_risks: 0,
  overdue_work_requests: 0,
  roadmap_with_budget: 0,
  intelligence_items: [],
  due_items: [],
  open_gaps: [],
  active_checklist_summaries: [],
});

describe("recreation ops leadership notifications", () => {
  it("emits compact alerts that deep-link to rec ops tabs", () => {
    const items = recreationOpsNotificationItems({
      ...emptyDash(),
      checklist_overdue: 2,
      knowledge_gaps_high: 1,
      profile_complete: false,
    });
    const ids = items.map((i) => i.id);
    expect(ids).toContain("rec-ops-checklist-overdue");
    expect(ids).toContain("rec-ops-gaps-high");
    expect(ids).toContain("rec-ops-profile");
    expect(operationalNotificationHref(items.find((i) => i.id === "rec-ops-checklist-overdue")!)).toBe(
      "/recreation/checklists",
    );
    expect(operationalNotificationHref(items.find((i) => i.id === "rec-ops-profile")!)).toBe("/recreation/me");
  });

  it("stays quiet when personal ops is current", () => {
    expect(recreationOpsNotificationItems(emptyDash())).toEqual([]);
  });
});
