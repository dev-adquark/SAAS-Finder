// Logo.dev integration (https://www.logo.dev). One place builds every product logo URL.
//
// - Lookup key: the hostname of the product's official URL (editorially set and verified), without
//   "www.". Never a guessed or derived domain: no parent-domain fallback, no name search.
// - Each hostname is checked server-side once per catalog load (cached 7 days). Only hostnames
//   Logo.dev actually has a logo for get a URL; anything else keeps the existing static icon or the
//   generated monogram (see components/identity.tsx).
// - Image URLs use the PUBLISHABLE key (LOGO_DEV_PUBLISHABLE_KEY), which Logo.dev designs to be
//   public. The secret key (LOGO_DEV_SECRET_KEY) is for server-side API calls only and is not
//   needed here: nothing reads it, so it can never reach client code.
import type { Product } from "@/lib/content/types";

const IMG = "https://img.logo.dev";
const CHECK_TIMEOUT_MS = 2500;
const CHECK_CONCURRENCY = 6;

export const logoDevKey = () => process.env.LOGO_DEV_PUBLISHABLE_KEY?.trim() || null;

/** The exact hostname of an official URL, minus "www."; null when it is not a usable public host. */
export function logoDomain(officialUrl: string | null | undefined): string | null {
  if (!officialUrl) return null;
  try {
    const u = new URL(officialUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && !/^(localhost|[0-9.]+)$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

/**
 * Base image URL for a domain (size is appended per rendering, see logoSrc). PNG keeps transparency,
 * retina doubles the pixel density, and fallback=404 turns "no logo" into an error the component
 * catches with its own fallback instead of Logo.dev's generic monogram.
 */
export function logoDevBase(domain: string, token: string): string {
  return `${IMG}/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&format=png&retina=true&fallback=404`;
}

/** Sized source for a base URL (CSS pixels; Logo.dev serves 2x with retina=true). */
export const logoSrc = (base: string, px: number) => `${base}&size=${Math.min(800, Math.max(16, Math.round(px)))}`;

/** Whether Logo.dev has a logo for this domain. null = could not tell (network/timeout). */
async function hasLogo(domain: string, token: string): Promise<boolean | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(logoSrc(logoDevBase(domain, token), 16), { signal: ctrl.signal, next: { revalidate: 7 * 86_400 } } as RequestInit);
    if (res.status === 404) return false;
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/") ? true : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Adds `logo` to each product whose official hostname Logo.dev resolves. A failed check never
 * fails the catalog: an unconfirmed domain still gets a URL (the browser falls back on error),
 * while a confirmed miss gets none.
 */
export async function withLogos<T extends Pick<Product, "officialUrl"> & { logo?: Product["logo"] }>(products: T[]): Promise<T[]> {
  const token = logoDevKey();
  if (!token) return products;
  const domains = [...new Set(products.map((p) => logoDomain(p.officialUrl)).filter((d): d is string => !!d))];
  const found = new Map<string, boolean | null>();
  for (let i = 0; i < domains.length; i += CHECK_CONCURRENCY) {
    const batch = domains.slice(i, i + CHECK_CONCURRENCY);
    const res = await Promise.all(batch.map((d) => hasLogo(d, token)));
    batch.forEach((d, k) => found.set(d, res[k]));
  }
  return products.map((p) => {
    const d = logoDomain(p.officialUrl);
    return d && found.get(d) !== false ? { ...p, logo: { base: logoDevBase(d, token), domain: d } } : p;
  });
}
