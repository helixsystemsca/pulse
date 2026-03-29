import type { Metadata } from "next";
import { Be_Vietnam_Pro, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-headline",
  display: "swap",
});

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://helixsystems.ca"),
  title: {
    default: "Helix Systems | Industrial field software & operations intelligence",
    template: "%s | Helix Systems",
  },
  description:
    "Helix Systems builds software for industrial operations—field teams, assets, and real-time intelligence. Pulse is our operational intelligence platform.",
  openGraph: {
    siteName: "Helix Systems",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${beVietnam.variable}`}>
      <body className="font-body text-helix-onSurface antialiased">
        {children}
      </body>
    </html>
  );
}
