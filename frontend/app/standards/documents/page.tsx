import { redirect } from "next/navigation";

/** Documents tab removed — attachments belong on procedures, routines, etc.; company files live in SharePoint. */
export default function StandardsDocumentsRedirectPage() {
  redirect("/standards/procedures");
}
