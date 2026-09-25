import assert from "node:assert/strict";
import test from "node:test";

// Runs against a disposable database only: TEST_DATABASE_URL must be set and is used as DATABASE_URL.
// `npm run test:db` resets that database, applies migrations and seeds it first.
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  test("database integration tests (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  process.env.DATABASE_URL = url;
  process.env.ADMIN_API_KEY = "integration-admin-key-123456";
  process.env.CRON_SECRET = "integration-cron-secret";

  const auth = { authorization: "Bearer integration-admin-key-123456", "content-type": "application/json" };
  const req = (path: string, init: RequestInit = {}) => new Request(`https://example.test${path}`, init);
  const p = <T>(v: T) => ({ params: Promise.resolve(v) });

  test("database integration", async (t) => {
    const { db } = await import("../lib/db");
    const svc = await import("../lib/admin/services");
    const { InputError } = await import("../lib/admin/inputs");
    const { loadCatalog } = await import("../lib/catalog");
    const productsApi = await import("../app/api/admin/products/route");
    const productApi = await import("../app/api/admin/products/[id]/route");
    const categoriesApi = await import("../app/api/admin/categories/route");
    const categoryApi = await import("../app/api/admin/categories/[id]/route");
    const pairsApi = await import("../app/api/admin/pairs/route");
    const snapshotsApi = await import("../app/api/admin/products/[id]/snapshots/route");
    const snapshotApi = await import("../app/api/admin/snapshots/[id]/route");
    const sponsorsApi = await import("../app/api/admin/sponsors/route");
    const altApi = await import("../app/api/admin/products/[id]/alternatives/route");
    const faqApi = await import("../app/api/admin/products/[id]/faqs/route");
    const analyticsAdmin = await import("../app/api/admin/analytics/route");
    const analyticsPublic = await import("../app/api/analytics/route");
    const cron = await import("../app/api/cron/content-refresh/route");
    const publicSponsors = await import("../app/api/sponsors/route");

    const json = (r: Response) => r.json() as Promise<Record<string, unknown>>;
    const post = <P,>(fn: (r: Request, c: { params: Promise<P> }) => Promise<Response>, path: string, body: unknown, params: P = {} as P) =>
      fn(req(path, { method: "POST", headers: auth, body: JSON.stringify(body) }), p(params));

    await t.test("seeded catalog loads from the database", async () => {
      const c = await loadCatalog();
      assert.equal(c.products.length, 16);
      assert.equal(c.useCases.length, 8);
      assert.equal(c.pairs.length, 16);
      assert.ok(c.products.every((x) => x.pricing.length === 0), "no unverified pricing is public");
    });

    let categoryId = "";
    let productId = "";
    await t.test("category CRUD with safe delete", async () => {
      const r = await post(categoriesApi.POST, "/api/admin/categories", { name: "Analytics" });
      assert.equal(r.status, 201);
      categoryId = String((await json(r)).id);
      const dup = await post(categoriesApi.POST, "/api/admin/categories", { name: "Analytics" });
      assert.equal(dup.status, 400);
      const patch = await categoryApi.PATCH(req("/x", { method: "PATCH", headers: auth, body: JSON.stringify({ intro: "Analytics hub intro." }) }), p({ id: categoryId }));
      assert.equal(patch.status, 200);
    });

    await t.test("product create → publish gate → complete → publish", async () => {
      const r = await post(productsApi.POST, "/api/admin/products", { slug: "plausible", name: "Plausible", categoryId, tagline: "Privacy-friendly web analytics.", description: "Lightweight analytics.", officialUrl: "https://plausible.io/", pricingUrl: "https://plausible.io/#pricing", features: ["Dashboards", "Goals", "No cookies"] });
      assert.equal(r.status, 201, JSON.stringify(await r.clone().json()));
      productId = String((await json(r)).id);
      const early = await productApi.PATCH(req("/x", { method: "PATCH", headers: auth, body: JSON.stringify({ status: "PUBLISHED" }) }), p({ id: productId }));
      assert.equal(early.status, 400);
      const problems = (await json(early)).problems as string[];
      assert.ok(problems[0].includes("FAQ") && problems[0].includes("alternative"), problems[0]);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: productId } })).status, "DRAFT", "failed publish rolled back");

      const wix = await db.product.findUniqueOrThrow({ where: { slug: "wix" } });
      assert.equal((await post(altApi.POST, "/x", { alternativeId: productId, rationale: "x" }, { id: productId })).status, 400, "self alternative");
      assert.equal((await post(altApi.POST, "/x", { alternativeId: wix.id, rationale: "Different category, used here only to satisfy the integration test." }, { id: productId })).status, 201);
      assert.equal((await post(faqApi.POST, "/x", { question: "Does it use cookies?", answer: "Check the vendor documentation." }, { id: productId })).status, 201);
      const complete = await productApi.PATCH(req("/x", { method: "PATCH", headers: auth, body: JSON.stringify({
        alternativesIntro: "Teams move off it when they need product analytics.",
        comparison: { tracking: "Pageviews and goals", reports: "Single dashboard", integrations: "Limited", privacy: "Cookieless" },
        review: { editorialSummary: "Simple analytics.", pros: ["Simple", "Light"], cons: ["Basic", "Few integrations"], bestFor: ["Small sites"], limitations: ["No product analytics"] },
        status: "PUBLISHED",
      }) }), p({ id: productId }));
      assert.equal(complete.status, 200, JSON.stringify(await complete.clone().json()));
      const row = await db.product.findUniqueOrThrow({ where: { id: productId } });
      assert.equal(row.status, "PUBLISHED");
      assert.ok(row.publishedAt);
    });

    await t.test("safe delete: published product and in-use category are protected", async () => {
      assert.equal((await productApi.DELETE(req("/x", { method: "DELETE", headers: auth }), p({ id: productId }))).status, 400);
      assert.equal((await categoryApi.DELETE(req("/x", { method: "DELETE", headers: auth }), p({ id: categoryId }))).status, 400);
    });

    await t.test("comparison pairs are canonical and reverse duplicates are impossible", async () => {
      const [wix, squarespace, webflow] = await Promise.all(["wix", "squarespace", "webflow"].map((slug) => db.product.findUniqueOrThrow({ where: { slug } })));
      assert.equal((await post(pairsApi.POST, "/x", { productAId: wix.id, productBId: squarespace.id, summary: "s", chooseA: "a", chooseB: "b" })).status, 400, "already exists as squarespace-vs-wix");
      await db.competitorPair.deleteMany({ where: { slug: "webflow-vs-wix" } });
      const thin = await post(pairsApi.POST, "/x", { productAId: wix.id, productBId: webflow.id, summary: "s", chooseA: "choose wix", chooseB: "choose webflow" });
      assert.equal(thin.status, 400, "thin comparison copy rejected");
      const created = await post(pairsApi.POST, "/x", {
        productAId: wix.id, productBId: webflow.id,
        summary: "Wix favours speed and guided setup, while Webflow favours precise visual control and a structured CMS.",
        chooseA: "choose wix when you want the fastest guided launch without design work.",
        chooseB: "choose webflow when you need pixel-level layout control and CMS collections.",
      });
      assert.equal(created.status, 201);
      const body = await json(created);
      assert.equal(body.slug, "webflow-vs-wix");
      assert.equal(body.productAId, webflow.id);
      assert.ok(String(body.chooseA).startsWith("choose webflow"), "copy swapped with canonical order");
      await assert.rejects(db.$executeRawUnsafe(`INSERT INTO "CompetitorPair" ("id","slug","productAId","productBId","categoryId","summary","chooseA","chooseB","highlights","updatedAt") VALUES ('rev1','reverse-dup','${wix.id}','${webflow.id}','${wix.categoryId}','s','a','b','[]',now())`));
    });

    await t.test("pricing workflow: pending → verify → supersede → last checked → changelog → refresh closed", async () => {
      const wix = await db.product.findUniqueOrThrow({ where: { slug: "wix" } });
      await db.contentRefresh.create({ data: { productId: wix.id, dueAt: new Date(), reason: "test" } });
      const add = (price: number) => post(snapshotsApi.POST, "/x", { summary: "Test plan", plan: "Test", price, currency: "usd", billingPeriod: "MONTHLY", sourceUrl: "https://www.wix.com/upgrade/website", sourceType: "OFFICIAL_PRICING_PAGE" }, { id: wix.id });
      const first = await json(await add(10));
      assert.equal(first.status, "PENDING");
      assert.equal((await loadCatalog()).products.find((x) => x.slug === "wix")?.pricing.length, 0, "pending pricing is never public");
      const v1 = await snapshotApi.PATCH(req("/x", { method: "PATCH", headers: auth, body: JSON.stringify({ action: "verify" }) }), p({ id: String(first.id) }));
      assert.equal(v1.status, 200);
      const second = await json(await add(12));
      await snapshotApi.PATCH(req("/x", { method: "PATCH", headers: auth, body: JSON.stringify({ action: "verify" }) }), p({ id: String(second.id) }));
      const snaps = await db.pricingSnapshot.findMany({ where: { productId: wix.id, plan: "Test" } });
      assert.equal(snaps.find((s) => s.id === first.id)?.status, "SUPERSEDED");
      assert.equal(snaps.find((s) => s.id === second.id)?.status, "VERIFIED");
      const product = await db.product.findUniqueOrThrow({ where: { id: wix.id }, include: { changelog: true, refreshes: { where: { completedAt: null } } } });
      assert.ok(product.pricingCheckedAt);
      assert.ok(product.changelog.some((c) => c.summary.includes("$12.00 per month")));
      assert.equal(product.refreshes.length, 0);
      const again = await snapshotApi.PATCH(req("/x", { method: "PATCH", headers: auth, body: JSON.stringify({ action: "verify" }) }), p({ id: String(second.id) }));
      assert.equal(again.status, 400, "cannot re-verify");
      const auto = await svc.addSnapshot(wix.id, { summary: "Detected change", sourceType: "AUTOMATED_DETECTION" }).catch((e) => e);
      assert.equal(auto.status, "PENDING");
      await assert.rejects(svc.addSnapshot(wix.id, { summary: "Detected", sourceType: "AUTOMATED_DETECTION" }, { verify: true }), InputError);
      const publicWix = (await loadCatalog()).products.find((x) => x.slug === "wix")!;
      assert.equal(publicWix.pricing.length, 1);
      assert.equal(publicWix.pricing[0].price, 12);
    });

    await t.test("cron queues refresh tasks for never-verified products only", async () => {
      assert.equal((await cron.GET(req("/api/cron/content-refresh"))).status, 401);
      const r = await cron.GET(req("/api/cron/content-refresh", { headers: { authorization: "Bearer integration-cron-secret" } }));
      assert.equal(r.status, 200);
      const body = await json(r);
      assert.equal(body.mode, "queue-only");
      assert.ok(Number(body.createdCount) > 1, "default batch (no ?limit) queues more than one product");
      const wix = await db.product.findUniqueOrThrow({ where: { slug: "wix" }, include: { refreshes: { where: { completedAt: null } } } });
      assert.equal(wix.refreshes.length, 0, "recently verified product is not queued");
      const trello = await db.product.findUniqueOrThrow({ where: { slug: "trello" }, include: { refreshes: { where: { completedAt: null } } } });
      assert.equal(trello.refreshes.length, 1);
      const second = await json(await cron.GET(req("/api/cron/content-refresh?limit=100", { headers: { authorization: "Bearer integration-cron-secret" } })));
      assert.equal(second.createdCount, 0, "idempotent");
      const done = await svc.resolveRefreshNoChange(trello.refreshes[0].id, "Checked official page");
      assert.ok(done.completedAt);
      assert.ok((await db.product.findUniqueOrThrow({ where: { slug: "trello" } })).pricingCheckedAt);
    });

    await t.test("sponsors: only active, in-date, complete slots are served", async () => {
      const make = (body: object) => post(sponsorsApi.POST, "/x", { title: "Acme", pageType: "product", placement: "sidebar", url: "https://acme.example", ...body });
      assert.equal((await make({ active: true, endsAt: "2020-01-01", startsAt: "2019-01-01" })).status, 201);
      assert.equal((await make({ active: false, priority: 90 })).status, 201);
      let feed = await json(await publicSponsors.GET(req("/api/sponsors?pageType=product&placement=sidebar")));
      assert.equal(feed.sponsor, null, "expired and inactive never render");
      assert.equal((await make({ active: true, title: "Live sponsor", label: "Sponsored" })).status, 201);
      feed = await json(await publicSponsors.GET(req("/api/sponsors?pageType=product&placement=sidebar")));
      assert.equal((feed.sponsor as { title: string }).title, "Live sponsor");
      assert.match((feed.sponsor as { label: string }).label, /Sponsored/);
      assert.equal("url" in (feed.sponsor as object), false, "destination only reachable via tracked /sponsor redirect");
      assert.equal((await publicSponsors.GET(req("/api/sponsors?pageType=home&placement=sidebar"))).status, 400);
    });

    await t.test("analytics: stored with campaign metadata and reported", async () => {
      const r = await analyticsPublic.POST(req("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "cta_click", path: "/wix", product: "wix", pageType: "product", pageSlug: "wix", ctaType: "hero", placement: "hero" }) }));
      assert.deepEqual(await r.json(), { ok: true, stored: true });
      await db.analyticsEvent.create({ data: { event: "sponsor_click", sponsorId: "s1", pageType: "product" } });
      const report = await json(await analyticsAdmin.GET(req("/api/admin/analytics", { headers: auth }), p({})));
      assert.ok((report.byEvent as { event: string; count: number }[]).some((x) => x.event === "cta_click" && x.count >= 1));
      assert.ok((report.ctaPerformance as { ctaType: string }[]).some((x) => x.ctaType === "hero"));
      assert.ok((report.sponsorClicks as { sponsorId: string }[]).some((x) => x.sponsorId === "s1"));
      assert.ok((report.byProduct as { productSlug: string }[]).some((x) => x.productSlug === "wix"));
    });

    await t.test("faq ownership constraint and publish-rule deletes", async () => {
      await assert.rejects(db.$executeRawUnsafe(`INSERT INTO "Faq" ("id","question","answer") VALUES ('orphan','q','a')`));
      const faq = await db.faq.findFirstOrThrow({ where: { productId } });
      await assert.rejects(svc.deleteFaq(faq.id), InputError, "last FAQ of a published product");
      const alt = await db.alternative.findFirstOrThrow({ where: { productId } });
      await assert.rejects(svc.deleteAlternative(alt.id), InputError, "last alternative of a published product");
      await svc.updateProduct(productId, { product: { status: "ARCHIVED" }, review: {} });
      assert.deepEqual(await svc.deleteProduct(productId), { ok: true });
      assert.deepEqual(await svc.deleteCategory(categoryId), { ok: true });
    });

    await db.$disconnect();
  });
}
