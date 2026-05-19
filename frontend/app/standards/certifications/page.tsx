import { redirect } from "next/navigation";

export const metadata = {
  title: "Certifications · Standards",
  description: "Canonical certification registry and employee credential tracking.",
};

export default function StandardsCertificationsPage() {
  redirect("/standards/training/certifications");
}
