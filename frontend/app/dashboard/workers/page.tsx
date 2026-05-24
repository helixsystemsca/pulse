import { redirect } from "next/navigation";

/** Legacy route — roster & permissions moved to Permissions. */
export default function WorkersDashboardRedirectPage() {
  redirect("/dashboard/permissions");
}
