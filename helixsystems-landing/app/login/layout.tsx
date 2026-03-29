import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Sign in | Pulse" },
  description: "Sign in to your Pulse operational dashboard.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
