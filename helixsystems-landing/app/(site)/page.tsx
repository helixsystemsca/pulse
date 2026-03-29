import {
  CompanyHero,
  ContactSection,
  HowWeWorkSection,
  PulsePreviewSection,
  WhatWeBuildSection,
} from "@/components/site";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-helix-bg">
      <CompanyHero />
      <HowWeWorkSection />
      <WhatWeBuildSection id="products" />
      <PulsePreviewSection />
      <ContactSection id="contact" />
    </main>
  );
}
