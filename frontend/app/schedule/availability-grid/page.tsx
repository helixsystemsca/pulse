import { redirect } from "next/navigation";

/** Legacy route — coverage / availability grid is integrated in Schedule. */
export default function ScheduleAvailabilityGridRedirectPage() {
  redirect("/schedule?availability=supervisor");
}
