import { redirect } from "next/navigation";

/** Legacy route — consolidated under Project Management. */
export default function PmPlanningRedirectPage() {
  redirect("/project-management?tab=cpm");
}
