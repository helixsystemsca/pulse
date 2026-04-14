import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Legacy URL — same hub; preserve query string (e.g. `?wr=`, `?create=`). */
export default async function LegacyMaintenanceWorkRequestsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, raw] of Object.entries(sp)) {
    if (raw === undefined) continue;
    if (Array.isArray(raw)) raw.forEach((v) => qs.append(k, v));
    else qs.set(k, raw);
  }
  const q = qs.toString();
  redirect(q ? `/dashboard/maintenance?${q}` : "/dashboard/maintenance");
}
