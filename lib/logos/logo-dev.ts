// Logo.dev integration (https://www.logo.dev). One place builds every product logo URL.
//
// - Lookup key: the hostname of the product's official URL (editorially set and verified), without
//   "www.". Never a guessed or derived domain: no parent-domain fallback, no name search.
// - The automatic sync (lib/sync/run.ts, every 31 days) verifies each product's hostname with
//   verifyLogo() and stores the result on the product (logoDomain / logoCheckedAt). Pages render
//   from that stored, verified state. Products the sync has not checked yet (new, or official URL
//   changed since) are checked at catalog load instead (withLogos, cached 7 days). Only hostnames
//   Logo.dev actually has a logo for get a URL; anything else keeps the existing static icon or the
//   generated monogram (see components/identity.tsx).
// - Image URLs use the PUBLISHABLE key (LOGO_DEV_PUBLISHABLE_KEY), which Logo.dev designs to be
//   public. The secret key (LOGO_DEV_SECRET_KEY) is for server-side API calls only and is not
//   needed here: nothing reads it, so it can never reach client code.
import type { Product } from "@/lib/content/types";

/** Overridable for tests (mock server); production always uses the public CDN. */
const IMG = () => process.env.LOGO_DEV_IMG_BASE?.replace(/\/+$/, "") || "https://img.logo.dev";
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
  return `${IMG()}/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&format=png&retina=true&fallback=404`;
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
 * Adds `logo` to each product whose logo state is still unknown (`logo === undefined`: never
 * verified by the sync, or its official URL changed since) and whose official hostname Logo.dev
 * resolves. Products the sync already verified are left as they are. A failed check never fails
 * the catalog: an unconfirmed domain still gets a URL (the browser falls back on error), while a
 * confirmed miss gets none.
 */
export async function withLogos<T extends Pick<Product, "officialUrl"> & { logo?: Product["logo"] }>(products: T[]): Promise<T[]> {
  const token = logoDevKey();
  if (!token) return products;
  const unknown = products.filter((p) => p.logo === undefined);
  const domains = [...new Set(unknown.map((p) => logoDomain(p.officialUrl)).filter((d): d is string => !!d))];
  if (!domains.length) return products;
  const found = new Map<string, boolean | null>();
  for (let i = 0; i < domains.length; i += CHECK_CONCURRENCY) {
    const batch = domains.slice(i, i + CHECK_CONCURRENCY);
    const res = await Promise.all(batch.map((d) => hasLogo(d, token)));
    batch.forEach((d, k) => found.set(d, res[k]));
  }
  return products.map((p) => {
    if (p.logo !== undefined) return p;
    const d = logoDomain(p.officialUrl);
    return d && found.get(d) !== false ? { ...p, logo: { base: logoDevBase(d, token), domain: d } } : p;
  });
}

export type LogoCheck = { result: "found" | "missing" | "error"; detail: string; attempts: number };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sync-grade verification of one domain: a real image response (status 200, image content type,
 * non-empty body) means found; 404 means Logo.dev has no logo; anything else (timeout, network,
 * 429, 5xx, a non-image body) is an error and is retried with backoff (Retry-After honoured,
 * capped). An error never counts as "missing", so it can never remove a stored logo.
 */
export async function verifyLogo(domain: string, opts: { retries?: number; timeoutMs?: number; token?: string | null } = {}): Promise<LogoCheck> {
  const token = opts.token ?? logoDevKey();
  if (!token) return { result: "error", detail: "LOGO_DEV_PUBLISHABLE_KEY is not configured", attempts: 0 };
  const retries = opts.retries ?? 2;
  let detail = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 5000);
    let wait = 500 * 2 ** attempt;
    try {
      const res = await fetch(logoSrc(logoDevBase(domain, token), 64), { signal: ctrl.signal, cache: "no-store" });
      if (res.status === 404) return { result: "missing", detail: "Logo.dev has no logo for this domain", attempts: attempt + 1 };
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.startsWith("image/")) {
        const size = (await res.arrayBuffer()).byteLength;
        if (size > 0) return { result: "found", detail: `${type}, ${size} bytes`, attempts: attempt + 1 };
        detail = "empty image response";
      } else {
        detail = `HTTP ${res.status}${res.ok ? ` (${type || "no content type"})` : ""}`;
        const ra = Number(res.headers.get("retry-after"));
        if (res.status === 429 && Number.isFinite(ra) && ra > 0) wait = Math.min(ra, 10) * 1000;
      }
    } catch (e) {
      detail = e instanceof Error && e.name === "AbortError" ? "timed out" : "network error";
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(wait);
  }
  return { result: "error", detail, attempts: retries + 1 };
}
