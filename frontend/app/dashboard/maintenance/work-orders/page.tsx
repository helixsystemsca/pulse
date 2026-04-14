import { redirect } from "next/navigation";

/** Legacy URL — work orders are listed in the unified hub. */
export default function LegacyMaintenanceWorkOrdersPage() {
  redirect("/dashboard/maintenance");
}
