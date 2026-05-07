import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import Script from "next/script";
import { ThemeRoot } from "@/components/theme/ThemeRoot";
import { THEME_STORAGE_KEY } from "@/lib/theme-constants";
import { PulseThemedBackground } from "@/components/app/PulseThemedBackground";
import "./globals.css";

const themeInitScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k)||localStorage.getItem("theme");if(t==="dark")document.documentElement.classList.add("dark");else document.documentElement.classList.remove("dark");}catch(e){}})();`;

/** Single stack — crisp UI typography (Gantt / PM reference: Inter-like rhythm). */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-app",
  display: "swap",
});

/** Poppins — top bar “PANORAMA PULSE” wordmark only; all other UI uses Inter (`--font-app`). */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-headline",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://helixsystems.ca"),
  title: {
    default: "Helix Systems | Panorama",
    template: "%s | Panorama",
  },
  description:
    "Helix Systems builds software for industrial operations—field teams, assets, and real-time intelligence. Panorama is our operational intelligence platform.",
  icons: {
    icon: [{ url: "/images/panoramalogo2.png", type: "image/png" }],
    apple: [{ url: "/images/panoramalogo2.png", type: "image/png" }],
  },
  openGraph: {
    siteName: "Helix Systems",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable}`}
      suppressHydrationWarning
    >
      <body className="font-body antialiased bg-ds-bg text-ds-foreground">
        <Script id="pulse-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <PulseThemedBackground />
        <ThemeRoot>{children}</ThemeRoot>
      </body>
    </html>
  );
}
