import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const loadSpatialAppPage = (): Promise<ComponentType<object>> =>
  import("@/drawings/SpatialAppPage").then((mod) => mod.default);

const SpatialAppPage = dynamic(loadSpatialAppPage, { ssr: false });

export default function Page() {
  return <SpatialAppPage />;
}
