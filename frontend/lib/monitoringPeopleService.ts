import { apiFetch } from "@/lib/api";

export type PeopleTaskMini = {
  id: string;
  title: string;
  status: string;
  due_date?: string | null;
  priority: number;
};

export type PeopleXpMini = {
  level: number;
  total_xp: number;
  into_level: number;
  pct: number;
};

export type WorkforceShiftBucket = "day" | "afternoon" | "night";

export type PeopleMonitorRow = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  roles: string[];
  workforce_shift?: WorkforceShiftBucket;
  xp: PeopleXpMini;
  recent_tasks: PeopleTaskMini[];
};

export async function fetchPeopleMonitoring(): Promise<PeopleMonitorRow[]> {
  return apiFetch<PeopleMonitorRow[]>("/api/v1/monitoring/people");
}

