import { redirect } from "next/navigation";

/** Legacy route — shift definitions live under Schedule settings. */
export default function ShiftDefinitionsRedirectPage() {
  redirect("/schedule?settings=shift-definitions");
}
