const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

if (process.env.NODE_ENV === "production" && !rawSiteUrl) {
  throw new Error("NEXT_PUBLIC_SITE_URL is required in production.");
}

export const SITE_NAME = "SaaSFinder";

export const siteUrl = rawSiteUrl || "http://localhost:3000";

export const absolute = (path: string) => new URL(path, siteUrl).toString();
