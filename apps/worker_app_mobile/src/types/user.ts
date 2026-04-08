export type UserRole = "admin" | "manager" | "technician";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

/** Fine-grained flags derived from role — extend as backend adds claims. */
export interface AppPermissions {
  viewTeamSchedule: boolean;
  viewAllProjects: boolean;
  manageProjects: boolean;
  flagIssuesOnAnyTask: boolean;
}
