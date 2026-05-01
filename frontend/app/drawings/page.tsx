import dynamic from "next/dynamic";

const DrawingsPage = dynamic(() => import("@/drawings/DrawingsPage"), { ssr: false });

export default function Page() {
  return <DrawingsPage />;
}

