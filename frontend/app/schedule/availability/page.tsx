import { redirect } from "next/navigation";

/** Legacy route — availability desk opens from the Schedule page. */
export default function ScheduleAvailabilityRedirectPage() {
  redirect("/schedule?availability=supervisor");
}
