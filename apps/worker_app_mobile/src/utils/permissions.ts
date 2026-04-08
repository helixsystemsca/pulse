import type { AppPermissions, UserRole } from "@/types/user";

export function getPermissionsForRole(role: UserRole): AppPermissions {
  switch (role) {
    case "admin":
      return {
        viewTeamSchedule: true,
        viewAllProjects: true,
        manageProjects: true,
        flagIssuesOnAnyTask: true,
      };
    case "manager":
      return {
        viewTeamSchedule: true,
        viewAllProjects: true,
        manageProjects: true,
        flagIssuesOnAnyTask: true,
      };
    case "technician":
    default:
      return {
        viewTeamSchedule: false,
        viewAllProjects: false,
        manageProjects: false,
        flagIssuesOnAnyTask: true,
      };
  }
}
