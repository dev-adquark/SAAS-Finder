import assert from "node:assert/strict";
import test from "node:test";
import { logoDevBase, logoDomain, logoSrc, withLogos } from "../lib/logos/logo-dev";
import type { LogoRef } from "../lib/content/types";

test("logoDomain: exact official hostname, never a guessed or parent domain", () => {
  assert.equal(logoDomain("https://www.asana.com/"), "asana.com");
  assert.equal(logoDomain("https://quickbooks.intuit.com/pricing"), "quickbooks.intuit.com", "subdomain kept as-is (no parent fallback)");
  assert.equal(logoDomain("https://us.norton.com/products"), "us.norton.com");
  assert.equal(logoDomain("http://example.org"), "example.org");
  for (const bad of [null, undefined, "", "not a url", "ftp://files.example.com", "https://localhost:3000", "https://127.0.0.1/"]) assert.equal(logoDomain(bad as never), null, String(bad));
});

test("logo URLs: publishable token, PNG, retina, 404 fallback; size clamped", () => {
  const base = logoDevBase("asana.com", "pk_test");
  assert.equal(base, "https://img.logo.dev/asana.com?token=pk_test&format=png&retina=true&fallback=404");
  assert.equal(logoSrc(base, 48), `${base}&size=48`);
  assert.equal(logoSrc(base, 4000), `${base}&size=800`);
  assert.equal(logoSrc(base, 3), `${base}&size=16`);
});

test("withLogos: no key → untouched; confirmed miss → no logo; check failure → still a URL (browser falls back)", async () => {
  const prev = { key: process.env.LOGO_DEV_PUBLISHABLE_KEY, fetch: globalThis.fetch };
  const products: { officialUrl: string; logo?: LogoRef | null }[] = [{ officialUrl: "https://asana.com/" }, { officialUrl: "https://unknown-brand.example/" }, { officialUrl: "https://flaky.example/" }, { officialUrl: "nope" }];
  delete process.env.LOGO_DEV_PUBLISHABLE_KEY;
  assert.deepEqual(await withLogos(products), products, "without a key nothing calls Logo.dev");
  process.env.LOGO_DEV_PUBLISHABLE_KEY = "pk_test";
  const seen: string[] = [];
  globalThis.fetch = (async (url: string) => {
    seen.push(String(url));
    if (String(url).includes("unknown-brand")) return new Response("", { status: 404 });
    if (String(url).includes("flaky")) throw new Error("network down");
    return new Response("png", { status: 200, headers: { "content-type": "image/png" } });
  }) as typeof fetch;
  try {
    const out = await withLogos(products);
    assert.equal(out[0].logo?.domain, "asana.com");
    assert.match(out[0].logo!.base, /token=pk_test/);
    assert.equal(out[1].logo, undefined, "a domain Logo.dev has no logo for keeps the existing fallback");
    assert.equal(out[2].logo?.domain, "flaky.example", "an unconfirmed check never removes the logo; the browser falls back on error");
    assert.equal(out[3].logo, undefined);
    assert.ok(seen.every((u) => u.startsWith("https://img.logo.dev/") && !u.includes("sk_")), "only the image CDN with the publishable key is called");
    assert.equal(new Set(seen).size, 3, "each domain checked once");
  } finally {
    globalThis.fetch = prev.fetch;
    if (prev.key === undefined) delete process.env.LOGO_DEV_PUBLISHABLE_KEY; else process.env.LOGO_DEV_PUBLISHABLE_KEY = prev.key;
  }
});
