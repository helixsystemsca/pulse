import { redirect } from "next/navigation";

/** Legacy route — feature toggles live under Settings. */
export default function AdminFeaturesRedirect() {
  redirect("/admin/settings");
}
