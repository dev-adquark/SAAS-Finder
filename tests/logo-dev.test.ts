import assert from "node:assert/strict";
import test from "node:test";
import { logoDevBase, logoDomain, logoSrc, verifyLogo, withLogos } from "../lib/logos/logo-dev";
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

test("verifyLogo: real image = found, 404 = missing, 429/5xx/timeout/non-image retried then error (never missing)", async () => {
  const prev = globalThis.fetch;
  const calls: Record<string, number> = {};
  globalThis.fetch = (async (url: string) => {
    const d = new URL(String(url)).pathname.slice(1);
    calls[d] = (calls[d] ?? 0) + 1;
    if (d === "ok.example") return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } });
    if (d === "none.example") return new Response("", { status: 404 });
    if (d === "flaky.example") return calls[d] < 2 ? new Response("", { status: 429, headers: { "retry-after": "0" } }) : new Response(new Uint8Array([9]), { status: 200, headers: { "content-type": "image/png" } });
    if (d === "html.example") return new Response("<html>", { status: 200, headers: { "content-type": "text/html" } });
    if (d === "empty.example") return new Response(new Uint8Array(), { status: 200, headers: { "content-type": "image/png" } });
    throw new Error("network");
  }) as typeof fetch;
  try {
    const t = { token: "pk_test" };
    assert.equal((await verifyLogo("ok.example", t)).result, "found");
    assert.equal((await verifyLogo("none.example", t)).result, "missing");
    const flaky = await verifyLogo("flaky.example", t);
    assert.equal(flaky.result, "found");
    assert.equal(flaky.attempts, 2, "a rate-limited request is retried");
    for (const d of ["html.example", "empty.example", "down.example"]) {
      const r = await verifyLogo(d, { ...t, retries: 1 });
      assert.equal(r.result, "error", `${d} is an error, not "missing"`);
      assert.equal(r.attempts, 2);
    }
    assert.equal((await verifyLogo("ok.example", { token: null })).result, process.env.LOGO_DEV_PUBLISHABLE_KEY ? "found" : "error", "no key → error, never missing");
  } finally {
    globalThis.fetch = prev;
  }
});
