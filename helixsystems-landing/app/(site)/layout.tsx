import { HelixFooter } from "@/components/site/HelixFooter";
import { HelixNavbar } from "@/components/site/HelixNavbar";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HelixNavbar />
      {children}
      <HelixFooter />
    </>
  );
}
