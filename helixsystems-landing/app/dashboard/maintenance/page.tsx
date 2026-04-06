import { redirect } from "next/navigation";

export default function MaintenanceIndexPage() {
  redirect("/dashboard/maintenance/work-orders");
}
