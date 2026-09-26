import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PageViewTracker } from "@/components/page-view";
import { RevealObserver } from "@/components/reveal-observer";
import { SITE_NAME, siteUrl } from "@/lib/site";

// One sans family for display and body. next/font preloads it and generates a metric-matched
// fallback, so the swap to the webfont causes no measurable layout shift.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap", preload: true });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${SITE_NAME} — Discover, compare and choose SaaS`, template: `%s | ${SITE_NAME}` },
  description: "Structured SaaS reviews, alternatives, comparisons and best-for guides for small businesses, creators, marketers and IT buyers.",
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f2ea" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <PageViewTracker />
        <RevealObserver />
      </body>
    </html>
  );
}
