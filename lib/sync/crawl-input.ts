// Input for the Apify Playwright scraper. Only the exact official URLs we list are fetched: no link
// following, bounded retries/concurrency/timeouts, and size caps on everything returned.

/** Runs inside the Apify actor (browser context via Playwright). Kept dependency-free on purpose. */
export const PAGE_FUNCTION = String.raw`async function pageFunction(context) {
  const { page, request, response } = context;
  try { await page.waitForLoadState("networkidle", { timeout: 15000 }); } catch (e) {}
  const data = await page.evaluate(() => {
    const cap = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");
    const meta = document.querySelector('meta[name="description"]') || document.querySelector('meta[property="og:description"]');
    return {
      title: cap(document.title, 300),
      description: meta ? cap(meta.getAttribute("content"), 1000) : null,
      canonical: document.querySelector('link[rel="canonical"]') ? document.querySelector('link[rel="canonical"]').href : null,
      text: cap(document.body ? document.body.innerText : "", 400000),
      html: cap(document.documentElement ? document.documentElement.outerHTML : "", 3000000),
      jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).slice(0, 30).map((s) => cap(s.textContent, 100000)),
      links: Array.from(document.querySelectorAll("a[href]")).slice(0, 1500).map((a) => ({ href: a.href, text: cap((a.textContent || "").trim(), 120) })),
    };
  });
  // context.response is not guaranteed by every actor version; fall back to the browser's own record.
  let status = response && typeof response.status === "function" ? response.status() : null;
  if (status === null) {
    try { status = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return n && n.responseStatus ? n.responseStatus : null; }); } catch (e) {}
  }
  return { requestUrl: request.url, loadedUrl: page.url(), status, fetchedAt: new Date().toISOString(), ...data };
}`;

export type CrawlLimits = { maxConcurrency: number; maxRequestRetries: number; pageLoadTimeoutSecs: number };
export const DEFAULT_LIMITS: CrawlLimits = { maxConcurrency: 3, maxRequestRetries: 2, pageLoadTimeoutSecs: 60 };

export function crawlInput(urls: string[], limits: CrawlLimits = DEFAULT_LIMITS) {
  const unique = [...new Set(urls)];
  return {
    startUrls: unique.map((url) => ({ url })),
    pageFunction: PAGE_FUNCTION,
    linkSelector: "",
    maxCrawlingDepth: 0,
    maxPagesPerCrawl: unique.length,
    maxResultsPerCrawl: unique.length,
    maxConcurrency: limits.maxConcurrency,
    maxRequestRetries: limits.maxRequestRetries,
    pageLoadTimeoutSecs: limits.pageLoadTimeoutSecs,
    pageFunctionTimeoutSecs: 60,
    waitUntil: "domcontentloaded",
    closeCookieModals: true,
    headless: true,
    launcher: "chromium",
    proxyConfiguration: { useApifyProxy: true },
  };
}
