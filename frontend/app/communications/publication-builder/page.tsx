import { redirect } from "next/navigation";

/** Legacy route — Publication pipeline merged into Xplor → InDesign. */
export default function PublicationBuilderRedirectPage() {
  redirect("/communications/indesign-pipeline");
}
