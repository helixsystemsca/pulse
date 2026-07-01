import { redirect } from "next/navigation";

export default function LegacyCoordinationRedirectPage() {
  redirect("/team-management/meetings/coordination");
}
