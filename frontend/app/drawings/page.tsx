import dynamic from "next/dynamic";

const DrawingsPage = dynamic(() => import("@/drawings/DrawingsPage").then((mod) => mod.default), { ssr: false });

export default function Page() {
  return <DrawingsPage />;
}

