import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Domain migration: old production hosts permanently redirect, path and query kept, to the canonical
// origin (NEXT_PUBLIC_SITE_URL, e.g. https://findmy.tech). Inactive until the canonical URL is set to
// a different host, so a redirect can never target a domain that is not live yet. /api/* is excluded
// so Vercel Cron and the Apify webhook are never redirected. Preview deployments are unaffected.
const LEGACY_HOSTS = (process.env.LEGACY_SITE_HOSTS ?? "saas-finder-reviews-delta.vercel.app,www.findmy.tech")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

function hostRedirects() {
  let canonical: URL;
  try {
    canonical = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  } catch {
    return [];
  }
  return LEGACY_HOSTS.filter((h) => h !== canonical.host).map((host) => ({
    source: "/:path((?!api/).*)",
    has: [{ type: "host" as const, value: host }],
    destination: `${canonical.origin}/:path`,
    permanent: true,
  }));
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
  // Legacy URL patterns permanently redirect to the canonical route registry (lib/seo/routes.ts).
  async redirects() {
    return [
      ...hostRedirects(),
      { source: "/products/:slug", destination: "/:slug", permanent: true },
      { source: "/categories/:slug", destination: "/category/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
