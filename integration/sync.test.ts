import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

// End-to-end sync pipeline against a disposable database and a mock Apify API (APIFY_API_BASE).
// Runs only when TEST_DATABASE_URL is set (see integration/db.test.ts).
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  test("sync integration tests (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  process.env.DATABASE_URL = url;
  process.env.CRON_SECRET = "integration-cron-secret";
  process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  type Responder = (url: string) => Record<string, unknown> | null;
  type G2Input = { startUrls?: { url: string }[]; searchQueries?: string[] };
  type G2Responder = (input: G2Input) => unknown[];
  const mock = {
    startFails: false,
    g2StartFails: false,
    runs: new Map<string, { status: string; items: unknown[] }>(),
    inputs: [] as { startUrls: { url: string }[] }[],
    g2Inputs: [] as G2Input[],
    responder: (() => null) as Responder,
    g2: (() => []) as G2Responder,
    garbage: [] as unknown[],
    // Logo.dev mock: per-domain behaviour and call counts (default: a real PNG).
    logo: {} as Record<string, "found" | "missing" | "error">,
    logoCalls: {} as Record<string, number>,
  };
  let seq = 0;
  const server = http.createServer((req, res) => {
    const send = (code: number, body: unknown) => (res.writeHead(code, { "content-type": "application/json" }), res.end(JSON.stringify(body)));
    const logo = req.url!.match(/^\/logo\/([^/?]+)\?(.*)$/);
    if (logo) {
      const d = decodeURIComponent(logo[1]);
      mock.logoCalls[d] = (mock.logoCalls[d] ?? 0) + 1;
      if (!new URLSearchParams(logo[2]).get("token")?.startsWith("pk_")) return send(401, {});
      const b = mock.logo[d] ?? "found";
      if (b === "missing") return (res.writeHead(404), res.end());
      if (b === "error") return (res.writeHead(503), res.end());
      res.writeHead(200, { "content-type": "image/png" });
      return res.end(Buffer.from([137, 80, 78, 71]));
    }
    if (req.headers.authorization !== `Bearer ${process.env.APIFY_API_TOKEN}`) return send(401, { error: { message: "unauthorized" } });
    const u = new URL(req.url!, "http://mock");
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.method === "POST" && /^\/acts\/[^/]*g2[^/]*\/runs$/.test(u.pathname)) {
        if (mock.g2StartFails) return send(500, { error: { message: "g2 platform error" } });
        const input = JSON.parse(body) as G2Input;
        mock.g2Inputs.push(input);
        const id = `g2run${++seq}`;
        mock.runs.set(id, { status: "RUNNING", items: mock.g2(input) });
        return send(201, { data: { id, status: "RUNNING", defaultDatasetId: `ds-${id}` } });
      }
      if (req.method === "POST" && /^\/acts\/[^/]+\/runs$/.test(u.pathname)) {
        if (mock.startFails) return send(500, { error: { message: "platform error" } });
        const input = JSON.parse(body) as { startUrls: { url: string }[] };
        mock.inputs.push(input);
        const id = `run${++seq}`;
        const items = [...input.startUrls.map((s) => mock.responder(s.url)).filter(Boolean), ...mock.garbage];
        mock.garbage = [];
        mock.runs.set(id, { status: "RUNNING", items });
        return send(201, { data: { id, status: "RUNNING", defaultDatasetId: `ds-${id}` } });
      }
      const run = u.pathname.match(/^\/actor-runs\/([^/]+)$/);
      if (run) return mock.runs.has(run[1]) ? send(200, { data: { id: run[1], status: mock.runs.get(run[1])!.status, defaultDatasetId: `ds-${run[1]}` } }) : send(404, { error: { message: "no run" } });
      const ds = u.pathname.match(/^\/datasets\/ds-([^/]+)\/items$/);
      if (ds) {
        const items = mock.runs.get(ds[1])?.items ?? [];
        const off = Number(u.searchParams.get("offset") ?? 0);
        const lim = Number(u.searchParams.get("limit") ?? 100);
        return send(200, items.slice(off, off + lim));
      }
      send(404, { error: { message: "not found" } });
    });
  });

  test("sync integration", async (t) => {
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    process.env.APIFY_API_BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const { db } = await import("../lib/db");
    const run = await import("../lib/sync/run");
    const review = await import("../lib/sync/review");
    const { productSyncStates } = await import("../lib/sync/dashboard");
    const cron = await import("../app/api/cron/apify-sync/route");
    const hook = await import("../app/api/apify/webhook/route");
    const finishAll = async () => {
      for (let i = 0; i < 200; i++) {
        for (const r of mock.runs.values()) r.status = "SUCCEEDED";
        const out = await run.advanceSyncs({ budgetMs: 60_000 });
        if (!out.results.length) break;
        // Another worker (e.g. the cron's background continuation) holds the lock: wait for it.
        if (out.results.every((r) => r.state === "locked")) await new Promise((r) => setTimeout(r, 25));
      }
    };
    const filler = " Official product information for this plan and its features. ".repeat(8);
    const page = (u: string, parts: string[], over: Record<string, unknown> = {}) => {
      const text = `${parts.join(" \n ")}${filler}`;
      return { requestUrl: u, loadedUrl: u, status: 200, title: "Official page", description: null, text, html: `<html><body><main>${parts.map((p) => `<p>${p}</p>`).join("")}${filler}</main></body></html>`, jsonLd: [], links: [], fetchedAt: new Date().toISOString(), ...over };
    };

    // Evidence currently cited per URL, so the default responder serves "unchanged" official pages.
    async function evidenceByUrl() {
      const m = new Map<string, string[]>();
      const add = (u: string | null | undefined, e: string | null | undefined) => {
        if (!u || !e) return;
        const k = u.replace(/\/$/, "");
        m.set(k, [...(m.get(k) ?? []), e]);
      };
      for (const f of await db.productFact.findMany({ where: { status: "VERIFIED" }, include: { source: true } })) add(f.source?.url, f.evidence);
      for (const s of await db.pricingSnapshot.findMany({ where: { status: "VERIFIED" }, include: { product: true } })) add(s.sourceUrl ?? s.product.pricingUrl, s.evidence);
      return m;
    }
    const unchanged = (ev: Map<string, string[]>): Responder => (u) => page(u, ev.get(u.replace(/\/$/, "")) ?? ["Official vendor page"]);

    const category = await db.category.findFirstOrThrow();
    const product = await db.product.create({
      data: {
        slug: "acme-sync-test", name: "Acme Sync", tagline: "Test product", description: "Test product for the sync pipeline.", status: "DRAFT", categoryId: category.id,
        officialUrl: "https://acme-sync.example/", pricingUrl: "https://acme-sync.example/pricing", features: [], comparison: {},
        sources: {
          create: [
            { kind: "PRICING", url: "https://acme-sync.example/pricing", name: "Acme pricing", status: "VERIFIED", checkedAt: new Date("2026-01-01") },
            { kind: "PRODUCT", url: "https://acme-sync.example/", name: "Acme home", status: "VERIFIED", checkedAt: new Date("2026-01-01") },
            { kind: "HELP_CENTER", url: "https://acme-sync.example/help", name: "Acme help", status: "VERIFIED", checkedAt: new Date("2026-01-01") },
            { kind: "SECURITY", url: "https://acme-sync.example/trust", name: "Acme trust", status: "VERIFIED", checkedAt: new Date("2026-01-01") },
          ],
        },
      },
      include: { sources: true },
    });
    const src = (kind: string) => product.sources.find((s) => s.kind === kind)!;
    await db.productFact.createMany({
      data: [
        { productId: product.id, key: "freePlan", value: "Free plan available", evidence: "Free plan available forever.", sourceId: src("PRICING").id, status: "VERIFIED", checkedAt: new Date("2026-01-01") },
        { productId: product.id, key: "support", value: "24/7 chat support", evidence: "Get 24/7 chat support from our team.", sourceId: src("HELP_CENTER").id, status: "VERIFIED", checkedAt: new Date("2026-01-01") },
        { productId: product.id, key: "security", value: "SOC 2 Type II", evidence: "Acme is SOC 2 Type II certified.", sourceId: src("SECURITY").id, status: "VERIFIED", checkedAt: new Date("2026-01-01") },
      ],
    });
    const old = await db.pricingSnapshot.create({ data: { productId: product.id, plan: "Starter", price: 12, currency: "USD", billingPeriod: "MONTHLY", unit: "per user per month, billed monthly", perSeat: true, sourceUrl: "https://acme-sync.example/pricing", sourceType: "OFFICIAL_PRICING_PAGE", status: "VERIFIED", verifiedAt: new Date("2026-01-01"), evidence: "Starter $12 per user/month, billed monthly.", summary: "Seeded for test" } });
    const pro = await db.pricingSnapshot.create({ data: { productId: product.id, plan: "Pro", price: 30, currency: "USD", billingPeriod: "MONTHLY", unit: "per user per month, billed monthly", perSeat: true, sourceUrl: "https://acme-sync.example/pricing", sourceType: "OFFICIAL_PRICING_PAGE", status: "VERIFIED", verifiedAt: new Date("2026-01-01"), evidence: "Pro $30 per user/month, billed monthly.", summary: "Seeded for test" } });

    const acme = (over: { pricing?: string[]; home?: Record<string, unknown> | null; help?: Record<string, unknown> | null; trust?: Record<string, unknown> | null } = {}): Responder => (u) => {
      const base = unchanged(evidence)(u);
      if (u === "https://acme-sync.example/pricing") return page(u, over.pricing ?? ["Starter $12 per user/month, billed monthly.", "Pro $30 per user/month, billed monthly.", "Free plan available forever."]);
      if (u === "https://acme-sync.example/") return over.home === undefined ? page(u, ["Acme home"], { links: [{ href: "https://acme-sync.example/status-page" }, { href: "https://acme-sync.example/privacy" }, { href: "https://elsewhere.example/terms" }] }) : over.home;
      if (u === "https://acme-sync.example/help") return over.help === undefined ? page(u, ["Get 24/7 chat support from our team."]) : over.help;
      if (u === "https://acme-sync.example/trust") return over.trust === undefined ? page(u, ["Acme is SOC 2 Type II certified."]) : over.trust;
      if (u === "https://acme-sync.example/privacy") return page(u, ["Privacy policy"], { title: "Acme Privacy Policy" });
      return base;
    };
    let evidence = await evidenceByUrl();
    const verifiedState = async () => ({
      snapshots: (await db.pricingSnapshot.findMany({ where: { status: "VERIFIED" }, select: { id: true, price: true }, orderBy: { id: "asc" } })).map((s) => `${s.id}:${s.price}`),
      facts: (await db.productFact.findMany({ where: { status: "VERIFIED" }, select: { id: true, value: true }, orderBy: { id: "asc" } })).map((f) => `${f.id}:${f.value}`),
      sources: (await db.productSource.findMany({ where: { status: "VERIFIED" }, select: { id: true, url: true }, orderBy: { id: "asc" } })).map((s) => `${s.id}:${s.url}`),
    });

    await t.test("disabled without APIFY_API_TOKEN; cron and webhook are authenticated", async () => {
      delete process.env.APIFY_API_TOKEN;
      await assert.rejects(run.startSync({ trigger: "MANUAL_FULL" }), run.SyncError);
      const disabled = await cron.GET(new Request("https://x.test/api/cron/apify-sync", { headers: { authorization: "Bearer integration-cron-secret" } }));
      assert.equal((await disabled.json()).configured, false);
      process.env.APIFY_API_TOKEN = "apify_api_integrationtoken0001";
      assert.equal((await cron.GET(new Request("https://x.test/api/cron/apify-sync"))).status, 401);
      assert.equal((await hook.POST(new Request("https://x.test/api/apify/webhook", { method: "POST", headers: { "x-sync-signature": "nope" } }))).status, 401);
      assert.equal((await hook.POST(new Request("https://x.test/api/apify/webhook", { method: "POST", headers: { "x-sync-signature": run.webhookSignature()! } }))).status, 202);
    });

    const g2rec = {
      search: (name: string, slug: string, domain: string, over: Record<string, unknown> = {}) => ({ itemType: "Software", foundVia: "g2", isSponsored: false, productName: name, productUrl: `https://www.g2.com/products/${slug}/reviews`, reviewsUrl: `https://www.g2.com/products/${slug}/reviews`, vendorName: null, ratingOutOfFive: 0, reviewCount: 0, relatedCategories: ["Project Management"], companyDomain: domain, companyWebsite: `https://${domain}`, descriptionSnippet: `${name} description`, scrapedAt: new Date().toISOString(), ...over }),
      summary: (slug: string, agg: number, total: number) => ({ type: "review_summary", productSlug: slug, productUrl: `https://www.g2.com/products/${slug}/reviews`, pros: [{ label: "Ease of Use", mentions: 40 }], cons: [{ label: "Learning Curve", mentions: 12 }], aggregateRating: agg, totalReviews: total, dataAsOf: new Date().toISOString() }),
      pricing: (slug: string, domain: string) => ({ type: "pricing", productSlug: slug, productUrl: `https://www.g2.com/products/${slug}`, pricingUrl: `https://www.g2.com/products/${slug}/pricing`, tiers: [], priceMin: 0, priceMax: 0, currency: "USD", keyInsights: "G2 pricing notes", faqs: [], status: "SUCCEEDED", companyDomain: domain }),
      competitor: (source: string, rank: number, name: string, slug: string, domain: string) => ({ type: "competitor", sourceProductSlug: source, competitorRank: rank, productName: name, productSlug: slug, productUrl: `https://www.g2.com/products/${slug}/reviews`, descriptionSnippet: `By ${name}`, ratingOutOfFive: 4.5, reviewCount: 900, companyDomain: domain, companyWebsite: `https://${domain}` }),
      review: (slug: string, id: string) => ({ type: "review", review_id: id, review_title: `Review ${id}`, review_content: "FULL REVIEW TEXT", review_rating: 4, product_slug: slug, review_link: `https://www.g2.com/products/${slug}/reviews/${slug}-review-${id}`, reviewer: { business_size: "Small-Business" }, publish_date: "2026-09-01T00:00:00Z" }),
    };
    /** Serves details for every known slug in startUrls using `details(slug)`; search via `search(query)`. */
    const g2Serve = (details: (slug: string) => unknown[], search: (q: string) => unknown[] = () => []): G2Responder => (input) => {
      const slugs = [...new Set((input.startUrls ?? []).map((s) => s.url.match(/products\/([^/]+)/)?.[1]).filter((x): x is string => !!x))];
      return [...slugs.flatMap(details), ...(input.searchQueries ?? []).flatMap(search)];
    };
    const allowRerun = () => db.syncRun.updateMany({ data: { startedAt: new Date(Date.now() - 7 * 3_600_000) } });

    await t.test("failed Apify start fails the run without touching data; scheduled retries stop after 3 attempts", async () => {
      const before = await verifiedState();
      mock.startFails = true;
      mock.g2StartFails = true;
      const cycle = new Date("2031-03-05T04:00:00Z");
      for (let i = 1; i <= 3; i++) {
        const r = await run.startSync({ trigger: "SCHEDULED", now: cycle });
        assert.equal(r.run?.status, "FAILED");
        assert.equal(r.run?.attempts, i);
        assert.match(r.run?.error ?? "", /Could not start the Apify crawl/);
        assert.match(r.run?.error ?? "", /Could not start the Apify G2 run/);
        assert.ok(!(r.run?.error ?? "").includes("integrationtoken"), "token never stored");
        const errs = ((r.run?.stats ?? {}) as { errors?: { source: string }[] }).errors ?? [];
        assert.deepEqual(errs.map((e) => e.source).sort(), ["G2", "Official websites"], "both source errors logged");
      }
      const gaveUp = await run.startSync({ trigger: "SCHEDULED", now: cycle });
      assert.equal(gaveUp.started, false);
      assert.match(gaveUp.reason ?? "", /Gave up/);
      mock.startFails = false;
      mock.g2StartFails = false;
      assert.deepEqual(await verifiedState(), before);
      assert.equal(await db.g2Listing.count(), 0);
    });

    await t.test("scheduled sync (official + G2) over unchanged pages re-confirms claims, changes nothing, is idempotent per 31-day cycle, and a duplicate cron starts nothing", async () => {
      evidence = await evidenceByUrl();
      mock.responder = (u) => (u.startsWith("https://acme-sync.example") ? acme()(u) : unchanged(evidence)(u));
      mock.g2 = () => [];
      const before = await verifiedState();
      const now = new Date();
      const [r, dup] = await Promise.all([run.startSync({ trigger: "SCHEDULED", now }), new Promise((res) => setTimeout(res, 5)).then(() => run.startSync({ trigger: "SCHEDULED", now }))]);
      assert.equal([r, dup].filter((x) => x.started).length, 1, "a duplicate cron invocation never starts a second sync");
      const started = r.started ? r : dup;
      const urls = mock.inputs.at(-1)!.startUrls.map((s) => s.url);
      assert.ok(urls.length > 10 && urls.every((u) => u.startsWith("https://")), "only official https URLs are crawled");
      assert.ok(!urls.some((u) => u.includes("acme-sync")), "draft products are not part of the scheduled run");
      // Concurrent advancing: the database lock lets exactly one worker process a run at a time.
      for (const x of mock.runs.values()) x.status = "SUCCEEDED";
      const both = await Promise.all([run.advanceSyncs({ budgetMs: 60_000 }), run.advanceSyncs({ budgetMs: 60_000 })]);
      assert.ok(both.flatMap((b) => b.results).some((x) => x.state === "locked"), "second worker is locked out");
      await finishAll();
      const done = await db.syncRun.findUniqueOrThrow({ where: { id: started.run!.id } });
      assert.equal(done.status, "COMPLETED");
      assert.equal(done.cycleKey, run.cycleKey(now));
      assert.ok(mock.g2Inputs.at(-1)?.searchQueries?.length, "G2 ran in the same sync (search for unlinked products)");
      const stats = done.stats as Record<string, number> & { actorRuns: { actor: string }[] };
      assert.ok(stats.claimsReverified > 50, `re-confirmed ${stats.claimsReverified}`);
      assert.deepEqual([...new Set(stats.actorRuns.map((a) => a.actor))].sort(), ["apify~playwright-scraper", "memo23~g2-scraper"], "both actors recorded");
      assert.equal(stats.g2NotListed, stats.productsInScope, "no G2 match is 'not listed', not a failure");
      const proposals = await db.dataChange.findMany({ where: { runId: done.id } });
      const withEvidence = [
        ...(await db.pricingSnapshot.findMany({ where: { id: { in: proposals.map((c) => c.targetId ?? "") }, evidence: { not: null } }, select: { id: true } })),
        ...(await db.productFact.findMany({ where: { id: { in: proposals.map((c) => c.targetId ?? "") }, evidence: { not: null } }, select: { id: true } })),
      ];
      assert.deepEqual(withEvidence, [], "no detection about an evidence-backed claim");
      assert.equal(proposals.filter((c) => c.kind === "PRICE_CHANGED" || c.kind === "SOURCE_NOT_FOUND" || c.kind === "NEW_PLAN").length, 0);
      assert.deepEqual(await verifiedState(), before, "no value changed");
      const pub = await db.product.findFirstOrThrow({ where: { status: "PUBLISHED", snapshots: { some: { status: "VERIFIED" } } }, select: { pricingCheckedAt: true } });
      assert.ok(pub.pricingCheckedAt && pub.pricingCheckedAt >= new Date(now.getTime() - 60_000), "pricing last-checked moves forward only after verbatim re-confirmation");
      const again = await run.startSync({ trigger: "SCHEDULED", now: new Date(now.getTime() + 3_600_000) });
      assert.equal(again.started, false);
      assert.match(again.reason ?? "", /Already synced/);
      const nextCycle = new Date(run.cycleStart(now).getTime() + 31 * 86_400_000);
      assert.equal(run.cycleKey(nextCycle) === done.cycleKey, false, "the next 31-day cycle is a new key");
    });

    let priceChange = "";
    await t.test("product sync: a changed official price and a new official link apply automatically; blocked and missing pages change nothing", async () => {
      await db.product.update({ where: { id: product.id }, data: { status: "PUBLISHED" } });
      const before = await verifiedState();
      mock.garbage = [{ junk: true }, "not-an-object", { requestUrl: "https://acme-sync.example/unknown", status: 200 }];
      mock.responder = acme({ pricing: ["Starter $15 per user/month, billed monthly.", "Pro $30 per user/month, billed monthly.", "Free plan available forever."], help: page("https://acme-sync.example/help", ["Access denied"], { status: 403 }), trust: null });
      const r = await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      mock.garbage = [];
      const done = await db.syncRun.findUniqueOrThrow({ where: { id: r.run!.id }, include: { pages: true } });
      assert.equal(done.status, "PARTIAL");
      assert.ok(done.pages.some((p) => p.phase === 2), "discovered links were validated in a second crawl");
      const byUrl = Object.fromEntries(done.pages.map((p) => [`${p.phase}:${p.url}`, p]));
      assert.equal(byUrl["1:https://acme-sync.example/help"].status, "BLOCKED");
      assert.equal(byUrl["1:https://acme-sync.example/trust"].status, "UNAVAILABLE");
      assert.match(byUrl["1:https://acme-sync.example/trust"].reason ?? "", /No result returned/);
      assert.equal((done.stats as Record<string, number>).validationFailures, 3, "malformed items are counted, not used");

      const changes = await db.dataChange.findMany({ where: { productId: product.id } });
      const price = changes.find((c) => c.kind === "PRICE_CHANGED")!;
      assert.equal(price.status, "ACCEPTED");
      assert.equal(price.reviewedBy, "auto-sync");
      assert.equal(price.targetId, old.id);
      priceChange = price.id;
      const link = changes.find((c) => c.kind === "NEW_SOURCE")!;
      assert.equal(link.status, "ACCEPTED", "a new official link is added automatically");
      assert.equal((link.payload as { url: string }).url, "https://acme-sync.example/privacy", "off-domain and unreturned links never proposed");
      assert.equal(changes.length, 2);

      const live = await db.pricingSnapshot.findMany({ where: { productId: product.id, status: "VERIFIED" }, orderBy: { plan: "asc" } });
      assert.deepEqual(live.map((x) => `${x.plan}:${Number(x.price)}`), ["Pro:30", "Starter:15"], "exactly one verified Starter price is public");
      assert.equal((await db.pricingSnapshot.findUniqueOrThrow({ where: { id: old.id } })).status, "SUPERSEDED");
      const fresh = live.find((x) => x.plan === "Starter")!;
      assert.equal(fresh.sourceType, "AUTOMATED_DETECTION");
      assert.equal(fresh.evidence?.startsWith("Starter $15"), true, "applied with its verbatim official quote");
      assert.equal((done.stats as Record<string, number>).changesApplied, 2);
      assert.ok((done.stats as Record<string, number>).productsUpdated >= 1);

      // Blocked / unavailable sources: nothing hidden, dates unchanged.
      const after = await verifiedState();
      assert.deepEqual(after.facts, before.facts, "facts untouched");
      const facts = await db.productFact.findMany({ where: { productId: product.id } });
      const f = (k: string) => facts.find((x) => x.key === k)!;
      assert.equal(f("support").checkedAt?.toISOString(), "2026-01-01T00:00:00.000Z", "blocked source keeps its last verified date");
      assert.equal(f("security").checkedAt?.toISOString(), "2026-01-01T00:00:00.000Z", "unavailable source keeps its last verified date");
      assert.ok(f("freePlan").checkedAt! > new Date("2026-01-02"), "re-confirmed fact date moves forward");
      assert.equal((await productSyncStates()).get(product.id)?.state, "partial");
    });

    await t.test("repeat sync does not duplicate detections; a reverted change stays reverted", async () => {
      await review.revertChange(priceChange);
      assert.equal((await db.pricingSnapshot.findUniqueOrThrow({ where: { id: old.id } })).status, "VERIFIED", "revert restores the previous price exactly");
      await allowRerun();
      await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      const all = await db.dataChange.findMany({ where: { productId: product.id } });
      assert.equal(all.filter((c) => c.kind === "PRICE_CHANGED").length, 1);
      assert.equal(all.find((c) => c.kind === "PRICE_CHANGED")!.status, "REVERTED", "an editor's revert is never re-applied");
      assert.equal(all.filter((c) => c.kind === "NEW_SOURCE").length, 1);
      assert.equal((await db.pricingSnapshot.findUniqueOrThrow({ where: { id: old.id } })).status, "VERIFIED");
      await assert.rejects(run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id }), /30 minutes/);
    });

    await t.test("removals apply only after a second successful run confirms them; returning evidence resolves them", async () => {
      await allowRerun();
      const gone = () => acme({ pricing: ["Starter $12 per user/month, billed monthly.", "Pro $30 per user/month, billed monthly."], trust: page("https://acme-sync.example/trust", ["Not found"], { status: 404 }) });
      mock.responder = gone();
      await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      let pend = await db.dataChange.findMany({ where: { productId: product.id, status: "PENDING" } });
      const factGone = pend.find((c) => c.kind === "FACT_NOT_FOUND")!;
      const pageGone = pend.find((c) => c.kind === "SOURCE_NOT_FOUND")!;
      assert.ok(factGone && pageGone, "first sighting is recorded, not applied");
      assert.equal((await db.productSource.findUniqueOrThrow({ where: { id: src("SECURITY").id } })).status, "VERIFIED");

      // Evidence returns: resolved automatically.
      await allowRerun();
      mock.responder = acme();
      await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      assert.equal((await db.dataChange.findUniqueOrThrow({ where: { id: factGone.id } })).status, "KEPT");
      assert.match((await db.dataChange.findUniqueOrThrow({ where: { id: factGone.id } })).note ?? "", /Resolved automatically/);

      // Gone twice in a row: applied (fact → not verified, page → broken), and revertible.
      for (let i = 0; i < 2; i++) {
        await allowRerun();
        mock.responder = gone();
        await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
        await finishAll();
        if (i === 0) {
          pend = await db.dataChange.findMany({ where: { productId: product.id, status: "PENDING" } });
          assert.ok(pend.some((c) => c.id === factGone.id), "an auto-resolved removal reopens as a first sighting");
        }
      }
      const fact = await db.dataChange.findUniqueOrThrow({ where: { id: factGone.id } });
      assert.equal(fact.status, "ACCEPTED");
      assert.equal(fact.reviewedBy, "auto-sync");
      assert.equal((await db.productFact.findFirstOrThrow({ where: { productId: product.id, key: "freePlan" } })).status, "NEEDS_VERIFICATION");
      assert.equal((await db.productSource.findUniqueOrThrow({ where: { id: src("SECURITY").id } })).status, "BROKEN");
      await review.revertChange(fact.id);
      assert.equal((await db.productFact.findFirstOrThrow({ where: { productId: product.id, key: "freePlan" } })).status, "VERIFIED");
      await review.revertChange((await db.dataChange.findFirstOrThrow({ where: { productId: product.id, kind: "SOURCE_NOT_FOUND", status: "ACCEPTED" } })).id);
      assert.equal((await db.productSource.findUniqueOrThrow({ where: { id: src("SECURITY").id } })).status, "VERIFIED");

      // Optional manual overrides still work; an off-domain link can never be accepted.
      const bad = await db.dataChange.create({ data: { productId: product.id, kind: "NEW_SOURCE", field: "Source · TERMS", sourceUrl: "https://elsewhere.example/terms", payload: { kind: "TERMS", url: "https://elsewhere.example/terms", name: "Terms" }, dedupeKey: "test-bad" } });
      await assert.rejects(review.acceptChange(bad.id), /not a valid official page/);
      await db.dataChange.delete({ where: { id: bad.id } });
    });

    await t.test("G2: fuzzy search matched by official domain only, details fetched in phase 4, stored, empty vendor auto-filled, shown publicly with attribution", async () => {
      await allowRerun();
      mock.responder = acme();
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).vendor, null);
      mock.g2 = g2Serve(
        (slug) => (slug === "acme-sync" ? [g2rec.summary("acme-sync", 8.6, 1200), g2rec.pricing("acme-sync", "acme-sync.example"), g2rec.review("acme-sync", "11"), g2rec.review("acme-sync", "12"), g2rec.competitor("acme-sync", 1, "NewTool", "newtool", "newtool.example")] : []),
        (q) => (q === "Acme Sync" ? [g2rec.search("Acme Syncer", "acme-syncer", "acme-syncer.io"), g2rec.search("Acme Sync", "acme-sync", "acme-sync.example", { vendorName: "Acme, Inc.", ratingOutOfFive: 4.1, reviewCount: 1100, isSponsored: false }), g2rec.search("Acme Sync Pro (Ad)", "acme-ad", "acme-sync.example", { isSponsored: true })] : []),
      );
      const r = await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      const done = await db.syncRun.findUniqueOrThrow({ where: { id: r.run!.id }, include: { pages: true } });
      assert.equal(done.status, "COMPLETED");
      assert.deepEqual(done.pages.filter((p) => p.phase >= 3).map((p) => `${p.phase}:${p.status}`).sort(), ["3:OK", "4:OK"], "search matched, then details fetched");
      assert.deepEqual(mock.g2Inputs.at(-1)!.startUrls!.map((s) => s.url)[0], "https://www.g2.com/products/acme-sync/reviews");
      const l = await db.g2Listing.findUniqueOrThrow({ where: { productId: product.id } });
      assert.equal(l.g2Slug, "acme-sync", "the noise result and the sponsored result were not used");
      assert.equal(l.rating, 4.1, "the listing's explicit 5-point rating wins over the summary's inferred-scale rating");
      assert.equal((l.reviewSummary as { rating: number }).rating, 4.3, "summary kept as source data");
      assert.equal(l.reviewCount, 1200);
      assert.equal((l.pricing as { keyInsights: string }).keyInsights, "G2 pricing notes");
      assert.equal(((l.recentReviews as { items: unknown[] }).items).length, 2);
      assert.ok(!JSON.stringify(l.recentReviews).includes("FULL REVIEW TEXT"), "review text never stored");
      assert.deepEqual(((l.competitors as { items: { slug: string }[] }).items).map((c) => c.slug), ["newtool"]);
      const p = await db.product.findUniqueOrThrow({ where: { id: product.id } });
      assert.equal(p.vendor, "Acme, Inc.", "configured empty field auto-filled");
      const changed = done.pages.flatMap((pg) => ((pg.outcome ?? {}) as { changed?: string[] }).changed ?? []);
      assert.ok(changed.includes("rating") && changed.includes("product.vendor"), `changed fields recorded: ${changed.join(",")}`);
      // No official price or editorial field comes from G2.
      assert.deepEqual((await db.pricingSnapshot.findMany({ where: { productId: product.id, status: "VERIFIED" } })).map((x) => Number(x.price)).sort(), [12, 30]);
      const { mapDbProduct } = await import("../lib/catalog");
      assert.equal(typeof mapDbProduct, "function");
      const { loadCatalog } = await import("../lib/catalog");
      const pub = (await loadCatalog()).products.find((x) => x.slug === product.slug);
      assert.deepEqual(pub?.g2 && { rating: pub.g2.rating, reviewCount: pub.g2.reviewCount, url: pub.g2.url }, { rating: 4.1, reviewCount: 1200, url: "https://www.g2.com/products/acme-sync/reviews" });
      assert.equal(pub?.review.rating ?? null, null, "editorial score untouched");

      // Editor value is never overwritten by G2.
      await db.product.update({ where: { id: product.id }, data: { vendor: "Acme Corporation" } });
      await allowRerun();
      mock.g2 = g2Serve((slug) => (slug === "acme-sync" ? [g2rec.search("Acme Sync", "acme-sync", "acme-sync.example", { vendorName: "Acme, Inc.", ratingOutOfFive: 4.1, reviewCount: 1100, type: "product" })] : []));
      await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).vendor, "Acme Corporation");
      const l2 = await db.g2Listing.findUniqueOrThrow({ where: { productId: product.id } });
      assert.equal(l2.reviewCount, 1100, "changed value updated");
      assert.equal((l2.pricing as { keyInsights: string }).keyInsights, "G2 pricing notes", "data missing from this run is kept");
    });

    await t.test("G2 failure or empty data never changes existing data; the official source still completes (partial)", async () => {
      const snapshot = async () => JSON.stringify(await db.g2Listing.findUniqueOrThrow({ where: { productId: product.id }, select: { rating: true, reviewCount: true, pricing: true, competitors: true, status: true } }));
      const before = await snapshot();
      await allowRerun();
      mock.g2StartFails = true;
      const failed = await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      mock.g2StartFails = false;
      const f = await db.syncRun.findUniqueOrThrow({ where: { id: failed.run!.id } });
      assert.equal(f.status, "PARTIAL", "official crawl succeeded, G2 failed");
      assert.ok(((f.stats as { errors?: { source: string; message: string }[] }).errors ?? []).some((e) => e.source === "G2" && /g2 platform error/.test(e.message)));
      assert.equal(await snapshot(), before);

      await allowRerun();
      mock.g2 = () => [];
      const empty = await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      const e = await db.syncRun.findUniqueOrThrow({ where: { id: empty.run!.id }, include: { pages: true } });
      assert.equal(e.pages.find((p) => p.phase === 3)?.status, "UNAVAILABLE", "known listing with no data is unavailable, not removed");
      assert.equal(await snapshot(), before, "empty dataset: no change");

      await allowRerun();
      mock.g2 = () => [{ type: "review_summary" }, { productName: "x" }, null, { type: "pricing", productSlug: "acme-sync", status: "FAILED" }];
      const bad = await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      const b = await db.syncRun.findUniqueOrThrow({ where: { id: bad.run!.id } });
      assert.equal((b.stats as Record<string, number>).g2Invalid, 4, "malformed G2 records are counted and skipped");
      assert.equal(await snapshot(), before);
    });

    await t.test("new products: a G2 competitor listed by two catalog products is created once as a draft; no duplicates", async () => {
      const pm = await db.product.findMany({ where: { status: "PUBLISHED", category: { slug: "project-management" } }, take: 2, orderBy: { slug: "asc" } });
      assert.equal(pm.length, 2);
      await db.g2Listing.createMany({ data: pm.map((p) => ({ productId: p.id, g2Slug: `${p.slug}-g2`, name: p.name, g2Url: `https://www.g2.com/products/${p.slug}-g2/reviews`, companyDomain: new URL(p.officialUrl).host.replace(/^www\./, "") })) });
      const other = await db.product.findFirstOrThrow({ where: { status: "PUBLISHED", id: { notIn: [...pm.map((p) => p.id), product.id] }, g2: null } });
      mock.responder = (u) => (u.startsWith("https://acme-sync.example") ? acme()(u) : unchanged(evidence)(u));
      mock.g2 = g2Serve((slug) =>
        pm.some((p) => `${p.slug}-g2` === slug)
          ? [
              g2rec.competitor(slug, 1, "Brand New Tool", "brand-new-tool", "brandnewtool.example"),
              g2rec.competitor(slug, 2, other.name, `${other.slug}-g2`, new URL(other.officialUrl).host.replace(/^www\./, "")),
              ...(slug === `${pm[0].slug}-g2` ? [g2rec.competitor(slug, 3, "Only Once", "only-once", "onlyonce.example")] : []),
            ]
          : [],
      );
      for (let i = 0; i < 2; i++) {
        await allowRerun();
        await run.startSync({ trigger: "MANUAL_FULL" });
        await finishAll();
      }
      const created = await db.product.findMany({ where: { autoCreatedAt: { not: null } } });
      assert.deepEqual(created.map((p) => p.slug), ["brand-new-tool"], "created once, never duplicated; single mentions are only tracked");
      assert.equal(created[0].status, "DRAFT", "not published without the editorial content the publish gate requires");
      assert.equal(created[0].officialUrl, "https://brandnewtool.example/");
      assert.equal(created[0].categoryId, pm[0].categoryId);
      assert.equal((await db.g2Listing.findUniqueOrThrow({ where: { g2Slug: "brand-new-tool" } })).productId, created[0].id);
      assert.equal((await db.g2Listing.findUniqueOrThrow({ where: { g2Slug: `${other.slug}-g2` } })).productId, other.id, "an existing product gains its G2 link by official domain instead of a duplicate");
      assert.equal((await db.g2Listing.findUniqueOrThrow({ where: { g2Slug: "only-once" } })).productId, null);
      const last = await db.syncRun.findFirstOrThrow({ where: { trigger: "MANUAL_FULL" }, orderBy: { startedAt: "desc" } });
      const firstFull = await db.syncRun.findFirstOrThrow({ where: { trigger: "MANUAL_FULL" }, orderBy: { startedAt: "asc" } });
      assert.equal((firstFull.stats as Record<string, number>).productsAdded + (last.stats as Record<string, number>).productsAdded, 1);
      await db.product.deleteMany({ where: { autoCreatedAt: { not: null } } });
      await db.g2Listing.deleteMany({ where: { productId: null } });
      await db.g2Listing.deleteMany({ where: { productId: { in: [...pm.map((p) => p.id), other.id] } } });
    });

    await t.test("manual sync uses the same pipeline and cooldowns; the cron endpoint starts the same flow", async () => {
      await assert.rejects(run.startSync({ trigger: "MANUAL_FULL" }), /6 hours/);
      await db.syncRun.deleteMany({ where: { trigger: "SCHEDULED" } });
      mock.g2 = g2Serve((slug) => (slug === "acme-sync" ? [g2rec.summary("acme-sync", 8.6, 1200)] : []));
      const res = await cron.GET(new Request("https://x.test/api/cron/apify-sync", { headers: { authorization: "Bearer integration-cron-secret" } }));
      const body = (await res.json()) as { started: boolean; runId: string };
      assert.equal(body.started, true);
      const again = await cron.GET(new Request("https://x.test/api/cron/apify-sync", { headers: { authorization: "Bearer integration-cron-secret" } }));
      assert.equal(((await again.json()) as { started: boolean }).started, false, "second cron call is a no-op");
      await finishAll();
      assert.equal((await db.syncRun.findUniqueOrThrow({ where: { id: body.runId } })).status, "COMPLETED");
    });

    await t.test("Logo.dev: verified logo stored and rendered; unchanged re-run; failures keep the logo; removal needs two misses", async () => {
      process.env.LOGO_DEV_PUBLISHABLE_KEY = "pk_integration";
      process.env.LOGO_DEV_IMG_BASE = `${process.env.APIFY_API_BASE}/logo`;
      mock.g2 = () => [];
      mock.responder = acme();
      const sync = async () => { await allowRerun(); const r = await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id }); await finishAll(); return db.syncRun.findUniqueOrThrow({ where: { id: r.run!.id }, include: { pages: true } }); };
      const p = () => db.product.findUniqueOrThrow({ where: { id: product.id }, select: { logoDomain: true, logoCheckedAt: true, logoMisses: true } });
      const { loadCatalog } = await import("../lib/catalog");
      const publicLogo = async () => (await loadCatalog()).products.find((x) => x.slug === product.slug)?.logo;

      let r = await sync();
      const page = r.pages.find((x) => x.phase === 5)!;
      assert.equal(page.status, "OK");
      assert.deepEqual((page.outcome as { changed: string[] }).changed, ["logo"]);
      assert.ok(!page.url.includes("pk_"), "the key is never stored");
      assert.equal((await p()).logoDomain, "acme-sync.example");
      assert.equal((r.stats as Record<string, number>).logosUpdated, 1);
      assert.match((await publicLogo())?.base ?? "", /\/logo\/acme-sync\.example\?token=pk_integration/, "pages render the verified logo");

      r = await sync();
      assert.equal((r.stats as Record<string, number>).logosUpdated, 0);
      assert.equal((r.stats as Record<string, number>).logosUnchanged, 1, "unchanged logo is not rewritten");

      mock.logo["acme-sync.example"] = "error";
      const calls = mock.logoCalls["acme-sync.example"] ?? 0;
      r = await sync();
      assert.equal(r.status, "PARTIAL");
      assert.equal(r.pages.find((x) => x.phase === 5)!.status, "UNAVAILABLE");
      assert.equal((mock.logoCalls["acme-sync.example"] ?? 0) - calls, 3, "retried before giving up");
      assert.equal((r.stats as Record<string, number>).logoRetries, 2);
      assert.equal((await p()).logoDomain, "acme-sync.example", "an API failure never removes a valid logo");
      assert.ok(await publicLogo(), "site still shows the logo");

      mock.logo["acme-sync.example"] = "missing";
      await sync();
      assert.equal((await p()).logoDomain, "acme-sync.example", "one 'no logo' result keeps the logo");
      assert.equal((await p()).logoMisses, 1);
      r = await sync();
      assert.equal((await p()).logoDomain, null, "removed only after a second consecutive miss");
      assert.equal(await publicLogo(), null, "a confirmed miss shows the static icon / monogram (no Logo.dev URL)");
      assert.equal((r.stats as Record<string, number>).logosUpdated, 1);
      mock.logo["acme-sync.example"] = "found";
      await sync();
      assert.equal((await p()).logoDomain, "acme-sync.example", "a logo that comes back is restored");
    });

    await t.test("Logo.dev phase: interrupted runs resume without re-checking, the lock prevents parallel processing, and it runs without Apify", async () => {
      const token = process.env.APIFY_API_TOKEN;
      delete process.env.APIFY_API_TOKEN;
      mock.logoCalls = {};
      const apifyStarts = mock.inputs.length + mock.g2Inputs.length;
      await allowRerun();
      const r = await run.startSync({ trigger: "MANUAL_FULL" });
      assert.equal(r.run?.phase, 5, "without Apify the run goes straight to Logo.dev");
      assert.equal(mock.inputs.length + mock.g2Inputs.length, apifyStarts, "no Apify run started");
      // Interrupt after one small batch (budget ~0), then resume; plus a concurrent worker.
      // Clock: calls 1–3 (deadline, lock, first loop check) see t=0; afterwards the 1ms budget is spent,
      // so exactly one batch is processed before the run stops — an interruption mid-phase.
      let calls = 0;
      const first = await run.advanceSyncs({ budgetMs: 1, now: () => (calls++ < 3 ? 0 : 10) });
      assert.equal(first.results[0].state, "processing", "interrupted mid-phase");
      const done1 = await db.syncPage.count({ where: { runId: r.run!.id, phase: 5, processedAt: { not: null } } });
      assert.ok(done1 > 0 && done1 < (await db.syncPage.count({ where: { runId: r.run!.id, phase: 5 } })), `partial progress saved (${done1})`);
      const [a, b] = await Promise.all([run.advanceSyncs({ budgetMs: 60_000 }), run.advanceSyncs({ budgetMs: 60_000 })]);
      assert.ok([...a.results, ...b.results].some((x) => x.state === "locked"), "the lock blocks a second worker");
      await finishAll();
      const fin = await db.syncRun.findUniqueOrThrow({ where: { id: r.run!.id }, include: { pages: true } });
      assert.equal(fin.status, "COMPLETED");
      const logoPages = fin.pages.filter((x) => x.phase === 5);
      assert.ok(logoPages.length > 10 && logoPages.every((x) => x.processedAt), "whole catalog processed");
      assert.ok(Object.values(mock.logoCalls).every((n) => n === 1), "each domain checked exactly once across the interruption");
      assert.equal(fin.pages.filter((x) => x.phase !== 5).length, 0);
      process.env.APIFY_API_TOKEN = token;
      delete process.env.LOGO_DEV_PUBLISHABLE_KEY;
      delete process.env.LOGO_DEV_IMG_BASE;
      await db.product.updateMany({ data: { logoDomain: null, logoCheckedAt: null, logoMisses: 0 } });
    });

    await db.g2Listing.deleteMany({});
    await db.product.delete({ where: { id: product.id } });
    await db.syncRun.deleteMany({});
    server.close();
  });
}
