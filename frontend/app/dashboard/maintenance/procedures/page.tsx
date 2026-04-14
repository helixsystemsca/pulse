import { redirect } from "next/navigation";

/** Legacy URL — procedures moved to `/dashboard/procedures`. */
export default function LegacyMaintenanceProceduresPage() {
  redirect("/dashboard/procedures");
}
