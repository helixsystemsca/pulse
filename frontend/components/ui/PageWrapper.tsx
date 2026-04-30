import type { ReactNode } from "react";

import { UI } from "@/styles/ui";

export function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <div className={UI.page}>
      <div className={UI.container}>{children}</div>
    </div>
  );
}
