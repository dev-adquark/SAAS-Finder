// Scratch: finds each vendor's own declared icons (apple-touch-icon / icon) on its official homepage.
import fs from "node:fs";
import { seedProducts } from "./lib/content/seed/products";
import { isOfficialUrl, officialDomains } from "./lib/research/evidence";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
(async () => {
  const out: Record<string, unknown> = {};
  for (const p of seedProducts) {
    const domains = officialDomains(p.slug, p.officialUrl);
    let html = "";
    let base = p.officialUrl;
    try {
      const r = await fetch(p.officialUrl, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
      html = await r.text(); base = r.url;
    } catch (e) { out[p.slug] = { error: String(e) }; continue; }
    const icons = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((t) => /rel=["'][^"']*(icon|apple-touch)[^"']*["']/i.test(t))
      .map((t) => ({ rel: t.match(/rel=["']([^"']+)/i)?.[1], href: t.match(/href=["']([^"']+)/i)?.[1], sizes: t.match(/sizes=["']([^"']+)/i)?.[1] ?? null, type: t.match(/type=["']([^"']+)/i)?.[1] ?? null }))
      .filter((i) => i.href).map((i) => ({ ...i, url: new URL(i.href!.replace(/&amp;/g, "&"), base).toString() }))
      .map((i) => ({ ...i, official: isOfficialUrl(i.url, domains) }));
    out[p.slug] = { base, icons };
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out) as [string, { icons?: { rel: string; sizes: string | null; url: string; official: boolean }[]; error?: string }][]) console.log(k.padEnd(14), v.error ?? v.icons!.map((i) => `${i.official ? "✓" : "✗"}${i.rel}${i.sizes ? `[${i.sizes}]` : ""} ${i.url.slice(0, 90)}`).slice(0, 4).join(" | "));
})();
