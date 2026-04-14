import { redirect } from "next/navigation";

/** Legacy URL — preventative rules are in the hub (expand “Preventative scheduling”). */
export default function LegacyMaintenancePreventativePage() {
  redirect("/dashboard/maintenance?hub=preventative");
}
