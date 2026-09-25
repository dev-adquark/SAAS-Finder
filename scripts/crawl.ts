export {};

/* Full-site crawl QA + end-to-end journey against a running server.
 *
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 *
 * Checks every sitemap URL (status, HTML, canonical, title, description, JSON-LD, disclosure,
 * sponsor labelling), every internal link found on those pages, the /go redirects, legacy and
 * reverse-compare redirects, and the homepage → category → product → alternatives → compare →
 * best-for → CTA → redirect journey. Exits non-zero on any failure.
 */

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
// Canonicals are built from NEXT_PUBLIC_SITE_URL, which may differ from BASE_URL (e.g. a preview).
const CANONICAL_ORIGIN = (process.env.CANONICAL_ORIGIN ?? BASE).replace(/\/+$/, "");
const CONCURRENCY = 6;

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);
const toPath = (u: string) => {
  const url = new URL(u, BASE);
  return url.pathname + url.search;
};

async function get(path: string, redirect: RequestRedirect = "manual") {
  const res = await fetch(BASE + path, { redirect, headers: { "user-agent": "saasfinder-crawl-qa" } });
  return { res, body: res.headers.get("content-type")?.includes("text") || res.headers.get("content-type")?.includes("json") || res.headers.get("content-type")?.includes("xml") ? await res.text() : "" };
}

const attr = (html: string, re: RegExp) => html.match(re)?.[1]?.replace(/&amp;/g, "&");
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

async function pool<T>(items: T[], fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

type PageReport = { path: string; canonical?: string; links: string[]; hasCta: boolean };

async function checkPage(path: string): Promise<PageReport> {
  const { res, body } = await get(path);
  const report: PageReport = { path, links: [], hasCta: false };
  if (res.status !== 200) {
    fail(`${path}: HTTP ${res.status}`);
    return report;
  }
  if (!res.headers.get("content-type")?.includes("text/html")) fail(`${path}: not HTML`);
  if (!/<html[^>]*lang="en"/.test(body)) fail(`${path}: missing <html lang>`);
  const title = attr(body, /<title>([^<]*)<\/title>/);
  const description = attr(body, /<meta name="description" content="([^"]*)"/);
  const canonical = attr(body, /<link rel="canonical" href="([^"]*)"/);
  const robots = attr(body, /<meta name="robots" content="([^"]*)"/);
  if (!title || title.length < 10) fail(`${path}: missing/short title`);
  if (!description || description.length < 50) fail(`${path}: missing/short description`);
  if (!attr(body, /<meta property="og:title" content="([^"]*)"/)) fail(`${path}: missing og:title`);
  if (!attr(body, /<meta name="twitter:card" content="([^"]*)"/)) fail(`${path}: missing twitter:card`);
  if (robots && /noindex/.test(robots)) fail(`${path}: sitemap URL is noindex`);
  if (!canonical) fail(`${path}: missing canonical`);
  else {
    report.canonical = canonical;
    const expected = CANONICAL_ORIGIN + (path === "/" ? "/" : path);
    // The root canonical may be emitted without its trailing slash; both denote the same URL.
    if (canonical !== expected && !(path === "/" && canonical === CANONICAL_ORIGIN)) fail(`${path}: canonical ${canonical} ≠ ${expected}`);
    if (/[?#]/.test(canonical)) fail(`${path}: canonical has query/fragment`);
  }
  if ((body.match(/<h1[\s>]/g) ?? []).length !== 1) fail(`${path}: expected exactly one <h1>`);
  for (const m of body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      if (data["@type"] === "FAQPage" && !(data.mainEntity?.length > 0)) fail(`${path}: empty FAQPage schema`);
      if (data["@type"] === "FAQPage" && !body.includes('id="faq"')) fail(`${path}: FAQPage schema without visible FAQ`);
      if (data.aggregateRating) fail(`${path}: aggregateRating emitted`);
      for (const offer of data.offers ?? []) if (!offer.price || !offer.priceCurrency) fail(`${path}: incomplete Offer`);
    } catch {
      fail(`${path}: invalid JSON-LD`);
    }
  }
  report.hasCta = body.includes("data-cta-type=");
  if (report.hasCta && !body.includes('data-disclosure="affiliate"')) fail(`${path}: CTA without affiliate disclosure`);
  for (const m of body.matchAll(/<a [^>]*href="([^"]+)"[^>]*>/g)) {
    const tag = m[0];
    const href = decode(m[1]);
    if (href.startsWith("/go/")) {
      if (!/rel="[^"]*nofollow/.test(tag)) fail(`${path}: /go link without nofollow`);
      const affiliate = /data-cta-kind="affiliate"/.test(body.slice(Math.max(0, (m.index ?? 0) - 300), m.index));
      if (affiliate && !/sponsored/.test(tag)) fail(`${path}: affiliate link without rel=sponsored`);
      report.links.push(href);
    } else if (href.startsWith("/") && !href.startsWith("//")) {
      report.links.push(href.split("#")[0] || "/");
    } else if (href.startsWith(CANONICAL_ORIGIN)) {
      report.links.push(toPath(href));
    }
  }
  if (/data-pricing="verified"/.test(body) === false && body.includes('id="pricing"') && !body.includes("Pricing varies — check the official pricing page.")) fail(`${path}: pricing section without verified data or fallback`);
  if (body.includes('id="pricing"') && !body.includes("Last checked")) fail(`${path}: pricing without Last checked`);
  // Visible text only: ignore scripts (RSC payload) and placeholder attributes.
  const visible = body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/placeholder="[^"]*"/g, "");
  if (/lorem ipsum|TODO|FIXME|placeholder/i.test(visible)) fail(`${path}: placeholder text`);
  return report;
}

async function main() {
  const started = Date.now();
  const { res: smRes, body: sitemap } = await get("/sitemap.xml");
  if (smRes.status !== 200) throw new Error(`sitemap.xml HTTP ${smRes.status}`);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (new Set(urls).size !== urls.length) fail("sitemap: duplicate URLs");
  const paths = urls.map((u) => {
    if (!u.startsWith(CANONICAL_ORIGIN)) fail(`sitemap: ${u} not on canonical origin`);
    return toPath(u);
  });
  for (const p of paths) if (/^\/(admin|api|go|sponsor)(\/|$)/.test(p)) fail(`sitemap: excluded path ${p}`);
  const types = { category: /^\/category\//, alternatives: /^\/alternatives\/.+/, compare: /^\/compare\//, best: /^\/best\/.+/, methodology: /^\/methodology$/, disclosure: /^\/disclosure$/ };
  for (const [name, re] of Object.entries(types)) if (!paths.some((p) => re.test(p))) fail(`sitemap: no ${name} pages`);

  const { body: robots } = await get("/robots.txt");
  for (const rule of ["Disallow: /admin", "Disallow: /api/", "Disallow: /go/", "Sitemap:"]) if (!robots.includes(rule)) fail(`robots.txt missing "${rule}"`);

  const reports: PageReport[] = [];
  await pool(paths, async (p) => void reports.push(await checkPage(p)));

  const canonicals = reports.map((r) => r.canonical).filter(Boolean);
  if (new Set(canonicals).size !== canonicals.length) fail("duplicate canonical URLs across pages");

  // Every internal link found on crawled pages.
  const sitemapSet = new Set(paths);
  const links = [...new Set(reports.flatMap((r) => r.links))];
  let checkedLinks = 0;
  await pool(links, async (href) => {
    checkedLinks++;
    const { res } = await get(href);
    const loc = res.headers.get("location") ?? "";
    if (href.startsWith("/go/")) {
      if (res.status !== 302) fail(`${href}: expected 302, got ${res.status}`);
      else if (!/^https:\/\//.test(loc)) fail(`${href}: unsafe redirect target ${loc}`);
      return;
    }
    if (res.status !== 200) fail(`internal link ${href}: HTTP ${res.status}${loc ? ` → ${loc}` : ""}`);
    else if (!sitemapSet.has(href.split("?")[0]) && !/^\/(admin|contact)/.test(href)) fail(`internal link ${href} is not in the sitemap`);
  });

  // /go safety.
  const goUnknown = await get("/go/does-not-exist");
  if (goUnknown.res.status !== 302 || !goUnknown.res.headers.get("location")?.endsWith("/products")) fail("/go/unknown must redirect to /products");
  const goEvil = await get("/go/wix?url=https://evil.example&next=//evil.example");
  if (!goEvil.res.headers.get("location")?.startsWith("https://www.wix.com/")) fail(`/go/wix ignored stored URL: ${goEvil.res.headers.get("location")}`);
  if (goEvil.res.headers.get("x-robots-tag") !== "noindex, nofollow") fail("/go must be noindex");
  const goTraversal = await get("/go/..%2F..%2Fadmin");
  // Either the app redirects to /products or the platform edge rejects the encoded path (4xx).
  const travOk = (goTraversal.res.status === 302 && goTraversal.res.headers.get("location")?.endsWith("/products")) || (goTraversal.res.status >= 400 && goTraversal.res.status < 500);
  if (!travOk) fail(`/go traversal not rejected (${goTraversal.res.status})`);

  // Redirect rules.
  const expectRedirect = async (from: string, to: string, status: number) => {
    const { res } = await get(from);
    const loc = res.headers.get("location");
    // A comma means duplicate Location headers were merged by fetch.
    if (res.status !== status || !loc || loc.includes(",") || toPath(loc) !== to) fail(`${from}: expected ${status} → ${to}, got ${res.status} → ${loc}`);
  };
  await expectRedirect("/compare/wix-vs-squarespace", "/compare/squarespace-vs-wix", 308);
  await expectRedirect("/compare/zoho-crm-vs-salesforce", "/compare/salesforce-vs-zoho-crm", 308);
  await expectRedirect("/products/wix", "/wix", 308);
  await expectRedirect("/categories/crm", "/category/crm", 308);
  // Non-curated pairs are never generated (no thin pages): the canonical form returns 404.
  const notCurated = await get("/compare/wix-vs-hubspot", "follow");
  if (notCurated.res.status !== 404) fail(`/compare/wix-vs-hubspot: expected final 404, got ${notCurated.res.status}`);
  const missing = await get("/definitely-not-a-product");
  if (missing.res.status !== 404) fail(`unknown product: expected 404, got ${missing.res.status}`);
  const admin = await get("/admin");
  if (admin.res.status !== 307 || !admin.res.headers.get("location")?.includes("/admin/login")) fail(`/admin unauthenticated: expected redirect to login, got ${admin.res.status}`);
  const adminApi = await get("/api/admin/products");
  if (adminApi.res.status !== 401) fail(`/api/admin/products unauthenticated: ${adminApi.res.status}`);
  const sponsorBad = await get("/sponsor/notreal123");
  if (sponsorBad.res.status !== 302 || !toPath(sponsorBad.res.headers.get("location") ?? "").startsWith("/")) fail("/sponsor/unknown must redirect home");
  const sponsorFeed = await get("/api/sponsors?pageType=product&placement=sidebar");
  try {
    const s = JSON.parse(sponsorFeed.body).sponsor;
    if (s && !/Sponsored/.test(s.label)) fail("sponsor feed label missing 'Sponsored'");
  } catch {
    fail("sponsor feed is not JSON");
  }

  // End-to-end journey.
  const journey: string[] = [];
  const step = async (path: string, pick: RegExp, label: string) => {
    const { res, body } = await get(path);
    journey.push(`${label} ${path} (${res.status})`);
    if (res.status !== 200) {
      fail(`journey: ${label} ${path} → ${res.status}`);
      return null;
    }
    const next = [...body.matchAll(/href="([^"]+)"/g)].map((m) => decode(m[1])).find((h) => pick.test(h));
    if (!next) fail(`journey: no link matching ${pick} on ${path}`);
    return next ?? null;
  };
  const category = await step("/", /^\/category\/[a-z0-9-]+$/, "home");
  const product = category && (await step(category, /^\/(?!category|compare|best|alternatives|products|categories|comparisons|methodology|disclosure|privacy|contact|go|admin)[a-z0-9-]+$/, "category"));
  const alternatives = product && (await step(product, /^\/alternatives\/[a-z0-9-]+$/, "product"));
  const compare = alternatives && (await step(alternatives, /^\/compare\/[a-z0-9-]+-vs-[a-z0-9-]+$/, "alternatives"));
  const back = compare && (await step(compare, /^\/category\/[a-z0-9-]+$/, "compare"));
  const best = back && (await step(back, /^\/best\/[a-z0-9-]+$/, "category"));
  const cta = best && (await step(best, /^\/go\/[a-z0-9-]+\?/, "best-for"));
  if (cta) {
    const { res } = await get(cta);
    journey.push(`cta ${cta} (${res.status} → ${res.headers.get("location")})`);
    if (res.status !== 302 || !res.headers.get("location")?.startsWith("https://")) fail(`journey: CTA ${cta} did not redirect safely`);
  }

  console.log(`Crawled ${paths.length} sitemap URLs and ${checkedLinks} unique internal links in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
  console.log("Journey:\n  " + journey.join("\n  "));
  if (failures.length) {
    console.error(`\n${failures.length} failure(s):\n- ${[...new Set(failures)].join("\n- ")}`);
    process.exit(1);
  }
  console.log("All crawl checks passed: 0 broken links, 0 unexpected 404s, 0 duplicate canonicals, 0 unsafe redirects, disclosures present.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
