import { redirect } from "next/navigation";

/** Vehicle QR destinations land here until a dedicated vehicle module ships. */
export default function VehicleQrDestinationPage({ params }: { params: { id: string } }) {
  redirect(`/equipment/${encodeURIComponent(params.id)}`);
}
