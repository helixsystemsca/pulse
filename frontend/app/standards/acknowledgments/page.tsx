import { redirect } from "next/navigation";

/** Legacy route — archive lives under Compliance. */
export default function StandardsAcknowledgmentsRedirectPage() {
  redirect("/standards/compliance?tab=archive");
}
