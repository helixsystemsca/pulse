/** Domain types for CMMS / work requests — structure for future FastAPI integration. */

export type WorkRequestStatus = "open" | "in_progress" | "completed" | "overdue";

export type WorkRequestPriority = "urgent" | "high" | "medium" | "low";

export type WorkerRef = {
  id: string;
  name: string;
  initials: string;
};

export type AssetRef = {
  id: string;
  label: string;
};

export type WorkRequest = {
  id: string;
  status: WorkRequestStatus;
  priority: WorkRequestPriority;
  asset: AssetRef;
  location: string;
  category: string;
  description: string;
  assignedTo: WorkerRef | null;
  dueDate: string;
};
