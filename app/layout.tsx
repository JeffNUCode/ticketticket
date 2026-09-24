import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import { AdSenseFooter, AdSenseScript } from "@/components/ads/adsense";
import { BottomNav, SiteHeader } from "@/components/layout/chrome";
import { Providers } from "@/components/providers";
import "./globals.css";

const display = Baloo_2({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const body = Nunito({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "GoSee! — showtimes & live events near you",
  description:
    "Movie showtimes, concerts, sports, comedy, and expos across the Philippines. Find what's near you, then book on the official site.",
  openGraph: { images: ["/logo.png"] },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${body.variable} ${display.variable}`}>
      <body className="pb-20 md:pb-0">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-zap focus:px-4 focus:py-2 focus:font-display focus:font-bold focus:text-black"
        >
          Skip to content
        </a>
        <Providers>
          <AdSenseScript />
          <SiteHeader />
          <main id="main" className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-6xl px-4 py-5 sm:py-6">
            {children}
          </main>
          <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs leading-relaxed text-white/50">
            <AdSenseFooter />
            <p className="mt-6">
              Movie details from TMDB, which does not endorse GoSee!. Tickets are sold on official
              cinema and promoter sites.
            </p>
          </footer>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
