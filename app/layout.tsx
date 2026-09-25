import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PageViewTracker } from "@/components/page-view";
import { SITE_NAME, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${SITE_NAME} — SaaS reviews, alternatives and comparisons`, template: `%s | ${SITE_NAME}` },
  description: "Structured SaaS reviews, alternatives, comparisons and best-for guides for small businesses, creators, marketers and IT buyers.",
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#07111f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <PageViewTracker />
      </body>
    </html>
  );
}
