export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "pending" | "in_progress" | "paused" | "completed";

export interface FieldTask {
  id: string;
  title: string;
  description: string;
  locationLabel: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueTime?: string;
}

export type ToolStatus = "available" | "in_use" | "missing";

export interface AssignedTool {
  id: string;
  name: string;
  assetTag: string;
  status: ToolStatus;
}

export interface ScheduleSlot {
  id: string;
  title: string;
  startLabel: string;
  endLabel: string;
  locationLabel: string;
  workerName?: string;
}

export interface BlueprintMarker {
  id: string;
  label: string;
  topPct: number;
  leftPct: number;
  equipmentName: string;
  activeTaskTitles: string[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  progressPct: number;
  statusLabel: string;
}
