import { redirect } from "next/navigation";

/** Legacy route — consolidated under Project Management. */
export default function PmWorkspaceRedirectPage() {
  redirect("/project-management?tab=workspace");
}
