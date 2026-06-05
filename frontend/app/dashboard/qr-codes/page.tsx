import { redirect } from "next/navigation";

/** Legacy route — QR management lives under Inventory → QR codes tab. */
export default function QrCodesPage() {
  redirect("/dashboard/inventory?tab=qr_codes");
}
