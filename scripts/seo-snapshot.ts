/* SEO invariance snapshot: title, description, canonical, robots, JSON-LD and internal link set
 * for every sitemap URL. Used to prove a design change did not alter SEO output.
 *   BASE_URL=... tsx scripts/seo-snapshot.ts > before.json   (then diff with an "after" run) */
export {};

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const ORIGIN = (process.env.CANONICAL_ORIGIN ?? BASE).replace(/\/+$/, "");

async function main() {
  const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const paths = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(ORIGIN, "") || "/");
  const out: Record<string, unknown> = { sitemap: paths };
  for (const p of paths) {
    const html = await (await fetch(BASE + p)).text();
    const get = (re: RegExp) => html.match(re)?.[1] ?? null;
    const jsonld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const links = [...new Set([...html.matchAll(/<a [^>]*href="(\/[^"#]*)/g)].map((m) => m[1].replace(/&amp;/g, "&")))].sort();
    out[p] = {
      title: get(/<title>([^<]*)<\/title>/),
      description: get(/<meta name="description" content="([^"]*)"/),
      canonical: get(/<link rel="canonical" href="([^"]*)"/),
      robots: get(/<meta name="robots" content="([^"]*)"/),
      og: get(/<meta property="og:title" content="([^"]*)"/),
      h1: (html.match(/<h1[\s>]/g) ?? []).length,
      jsonld,
      links,
    };
  }
  console.log(JSON.stringify(out, null, 1));
}

void main();
