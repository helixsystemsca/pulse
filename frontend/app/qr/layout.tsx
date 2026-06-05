import { Suspense } from "react";

export default function QrLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-pulse-muted">
          Opening resource…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
