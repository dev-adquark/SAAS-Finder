// Canonical origin. Production must set NEXT_PUBLIC_SITE_URL; Vercel preview deployments fall back
// to their own deployment URL (Vercel serves previews with X-Robots-Tag: noindex).
const previewUrl = process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const rawSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || previewUrl)?.replace(/\/+$/, "");

if (process.env.NODE_ENV === "production" && !rawSiteUrl) {
  throw new Error("NEXT_PUBLIC_SITE_URL is required in production.");
}

export const SITE_NAME = "SaaSFinder";

export const siteUrl = rawSiteUrl || "http://localhost:3000";

export const absolute = (path: string) => new URL(path, siteUrl).toString();
