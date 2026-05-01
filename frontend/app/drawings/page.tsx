import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const loadDrawingsPage = (): Promise<ComponentType<object>> =>
  import("@/drawings/DrawingsPage").then((mod) => mod.default);

const DrawingsPage = dynamic(loadDrawingsPage, { ssr: false });

export default function Page() {
  return <DrawingsPage />;
}
