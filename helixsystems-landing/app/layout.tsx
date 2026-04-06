import type { Metadata } from "next";
import { Be_Vietnam_Pro, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { ThemeRoot } from "@/components/theme/ThemeRoot";
import { THEME_STORAGE_KEY } from "@/lib/theme-constants";
import "./globals.css";

const themeInitScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t==="dark")document.documentElement.classList.add("dark");else document.documentElement.classList.remove("dark");}catch(e){}})();`;

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
    <html lang="en" className={`${plusJakarta.variable} ${beVietnam.variable}`} suppressHydrationWarning>
      <body className="font-body text-helix-onSurface antialiased dark:bg-[#0c1424] dark:text-slate-100">
        <Script id="pulse-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ThemeRoot>{children}</ThemeRoot>
      </body>
    </html>
  );
}
