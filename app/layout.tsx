import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import { BottomNav, SiteHeader } from "@/components/layout/chrome";
import { Providers } from "@/components/providers";
import "./globals.css";

const display = Baloo_2({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const body = Nunito({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "GoSee! — movies near you",
  description:
    "Showtimes, cinema chains, and mall dining deals across Metro Manila, Cebu, Davao, and Bangkok.",
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
          Skip to showtimes
        </a>
        <Providers>
          <SiteHeader />
          <main id="main" className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-6xl px-4 py-5 sm:py-6">
            {children}
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
