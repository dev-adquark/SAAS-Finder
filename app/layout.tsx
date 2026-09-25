import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PageViewTracker } from "@/components/page-view";
import { RevealObserver } from "@/components/reveal-observer";
import { SITE_NAME, siteUrl } from "@/lib/site";

// Display face uses font-display: optional so a late webfont never reflows large headlines (CLS).
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "optional", preload: true, style: ["normal", "italic"], axes: ["opsz"] });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
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
    <html lang="en" className={`${fraunces.variable} ${geist.variable} ${geistMono.variable}`}>
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
