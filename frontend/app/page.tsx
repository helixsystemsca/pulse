import {
  CompanyHero,
  ContactSection,
  HowWeWorkSection,
  PulsePreviewSection,
  WhatWeBuildSection,
} from "@/components/site";
import { HelixFooter } from "@/components/site/HelixFooter";
import { HelixNavbar } from "@/components/site/HelixNavbar";

export default function HomePage() {
  return (
    <>
      <HelixNavbar />
      <main className="min-h-screen bg-helix-bg">
        <CompanyHero />
        <HowWeWorkSection />
        <WhatWeBuildSection id="products" />
        <PulsePreviewSection />
        <ContactSection id="contact" />
      </main>
      <HelixFooter />
    </>
  );
}
