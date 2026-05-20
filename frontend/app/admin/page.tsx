import { redirect } from "next/navigation";

/** Legacy `/admin` bookmarks → unified tenant leadership dashboard. */
export default function AdminLegacyRedirectPage() {
  redirect("/overview");
}
