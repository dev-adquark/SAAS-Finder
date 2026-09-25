import assert from "node:assert/strict";
import test from "node:test";

// Admin API behaviour that must hold without a database: authentication first, then validation.
process.env.ADMIN_API_KEY = "api-test-key-0123456789";
process.env.DATABASE_URL ??= "postgresql://invalid:invalid@127.0.0.1:1/none";

const auth = { authorization: "Bearer api-test-key-0123456789", "content-type": "application/json" };
const req = (path: string, init: RequestInit = {}) => new Request(`https://example.test${path}`, init);
const params = <T>(p: T) => ({ params: Promise.resolve(p) });

test("every admin endpoint rejects unauthenticated and wrong-key requests", async () => {
  const products = await import("../app/api/admin/products/route");
  const product = await import("../app/api/admin/products/[id]/route");
  const sponsors = await import("../app/api/admin/sponsors/route");
  const analytics = await import("../app/api/admin/analytics/route");
  const pairs = await import("../app/api/admin/pairs/route");
  const revalidate = await import("../app/api/admin/revalidate/route");
  const cases: [string, () => Promise<Response>][] = [
    ["GET products", () => products.GET(req("/api/admin/products"), params({}))],
    ["POST products", () => products.POST(req("/api/admin/products", { method: "POST", body: "{}" }), params({}))],
    ["DELETE product", () => product.DELETE(req("/api/admin/products/x", { method: "DELETE", headers: { authorization: "Bearer wrong" } }), params({ id: "x" }))],
    ["GET sponsors", () => sponsors.GET(req("/api/admin/sponsors", { headers: { authorization: "api-test-key-0123456789" } }), params({}))],
    ["GET analytics", () => analytics.GET(req("/api/admin/analytics"), params({}))],
    ["POST pairs", () => pairs.POST(req("/api/admin/pairs", { method: "POST", body: "{}" }), params({}))],
    ["POST revalidate", () => revalidate.POST(req("/api/admin/revalidate", { method: "POST" }), params({}))],
  ];
  for (const [name, call] of cases) assert.equal((await call()).status, 401, name);
});

test("admin key shorter than 16 characters disables admin access", async () => {
  const prev = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = "short";
  const products = await import("../app/api/admin/products/route");
  assert.equal((await products.GET(req("/api/admin/products", { headers: { authorization: "Bearer short" } }), params({}))).status, 401);
  process.env.ADMIN_API_KEY = prev;
});

test("invalid payloads are rejected with 400 before touching the database", async () => {
  const products = await import("../app/api/admin/products/route");
  const sponsors = await import("../app/api/admin/sponsors/route");
  const snapshots = await import("../app/api/admin/products/[id]/snapshots/route");
  const bad = [
    await products.POST(req("/api/admin/products", { method: "POST", headers: auth, body: "not json" }), params({})),
    await products.POST(req("/api/admin/products", { method: "POST", headers: auth, body: JSON.stringify({ slug: "admin" }) }), params({})),
    await products.POST(req("/api/admin/products", { method: "POST", headers: auth, body: JSON.stringify([1, 2]) }), params({})),
    await sponsors.POST(req("/api/admin/sponsors", { method: "POST", headers: auth, body: JSON.stringify({ title: "x", pageType: "product", placement: "sidebar", url: "javascript:1" }) }), params({})),
    await snapshots.POST(req("/api/admin/products/x/snapshots", { method: "POST", headers: auth, body: JSON.stringify({ summary: "x", price: 10 }) }), params({ id: "x" })),
    await products.POST(req("/api/admin/products", { method: "POST", headers: auth, body: "x".repeat(70_000) }), params({})),
  ];
  for (const [i, r] of bad.entries()) {
    assert.equal(r.status, 400, `case ${i}`);
    const body = await r.json();
    assert.ok(Array.isArray(body.problems), `case ${i} returns problems`);
    assert.equal(JSON.stringify(body).includes("prisma"), false, "no internal details");
  }
});

test("cron endpoint requires the cron secret", async () => {
  process.env.CRON_SECRET = "cron-secret-for-tests";
  const cron = await import("../app/api/cron/content-refresh/route");
  assert.equal((await cron.GET(req("/api/cron/content-refresh"))).status, 401);
  assert.equal((await cron.GET(req("/api/cron/content-refresh", { headers: { authorization: "Bearer nope" } }))).status, 401);
});

test("public analytics endpoint validates input and degrades gracefully", async () => {
  const analytics = await import("../app/api/analytics/route");
  const post = (body: string, headers: Record<string, string> = {}) => analytics.POST(req("/api/analytics", { method: "POST", headers: { "content-type": "application/json", ...headers }, body }));
  assert.equal((await post(JSON.stringify({ event: "hack" }))).status, 400);
  assert.equal((await post("{")).status, 400);
  assert.equal((await post("x", { "content-length": "999999" })).status, 413);
  // Database is unreachable here: the event is accepted but not stored, and no error leaks.
  const ok = await post(JSON.stringify({ event: "page_view", path: "/" }));
  assert.equal(ok.status, 202);
  assert.deepEqual(await ok.json(), { ok: true, stored: false });
});
