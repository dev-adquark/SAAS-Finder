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
  const mock = {
    startFails: false,
    runs: new Map<string, { status: string; items: unknown[] }>(),
    inputs: [] as { startUrls: { url: string }[] }[],
    responder: (() => null) as Responder,
    garbage: [] as unknown[],
  };
  let seq = 0;
  const server = http.createServer((req, res) => {
    const send = (code: number, body: unknown) => (res.writeHead(code, { "content-type": "application/json" }), res.end(JSON.stringify(body)));
    if (req.headers.authorization !== `Bearer ${process.env.APIFY_API_TOKEN}`) return send(401, { error: { message: "unauthorized" } });
    const u = new URL(req.url!, "http://mock");
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
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
      for (const r of mock.runs.values()) r.status = "SUCCEEDED";
      for (let i = 0; i < 20; i++) {
        const out = await run.advanceSyncs({ budgetMs: 60_000 });
        if (!out.results.length) break;
        for (const r of mock.runs.values()) r.status = "SUCCEEDED";
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

    await t.test("failed Apify start fails the run without touching data; scheduled retries stop after 3 attempts", async () => {
      const before = await verifiedState();
      mock.startFails = true;
      const week = new Date("2031-03-05T04:00:00Z");
      for (let i = 1; i <= 3; i++) {
        const r = await run.startSync({ trigger: "SCHEDULED", now: week });
        assert.equal(r.run?.status, "FAILED");
        assert.equal(r.run?.attempts, i);
        assert.match(r.run?.error ?? "", /Could not start the Apify crawl/);
        assert.ok(!(r.run?.error ?? "").includes("integrationtoken"), "token never stored");
      }
      const gaveUp = await run.startSync({ trigger: "SCHEDULED", now: week });
      assert.equal(gaveUp.started, false);
      assert.match(gaveUp.reason ?? "", /Gave up/);
      mock.startFails = false;
      assert.deepEqual(await verifiedState(), before);
    });

    await t.test("weekly sync over unchanged official pages re-confirms claims, proposes nothing, and is idempotent per week", async () => {
      evidence = await evidenceByUrl();
      mock.responder = (u) => (u.startsWith("https://acme-sync.example") ? acme()(u) : unchanged(evidence)(u));
      const before = await verifiedState();
      const now = new Date();
      const r = await run.startSync({ trigger: "SCHEDULED", now });
      assert.equal(r.started, true);
      const urls = mock.inputs.at(-1)!.startUrls.map((s) => s.url);
      assert.ok(urls.length > 10 && urls.every((u) => u.startsWith("https://")), "only official https URLs are crawled");
      assert.ok(!urls.some((u) => u.includes("acme-sync")), "draft products are not part of the scheduled run");
      await finishAll();
      const done = await db.syncRun.findUniqueOrThrow({ where: { id: r.run!.id } });
      assert.equal(done.status, "COMPLETED");
      const stats = done.stats as Record<string, number>;
      assert.ok(stats.claimsReverified > 50, `re-confirmed ${stats.claimsReverified}`);
      // Unchanged pages never produce a proposal about an evidence-backed claim. (Legacy manual entries
      // without a stored quote cannot be re-confirmed automatically and are left for editors.)
      const proposals = await db.dataChange.findMany({ where: { runId: done.id } });
      const withEvidence = [
        ...(await db.pricingSnapshot.findMany({ where: { id: { in: proposals.map((c) => c.targetId ?? "") }, evidence: { not: null } }, select: { id: true } })),
        ...(await db.productFact.findMany({ where: { id: { in: proposals.map((c) => c.targetId ?? "") }, evidence: { not: null } }, select: { id: true } })),
      ];
      assert.deepEqual(withEvidence, [], "no proposal about an evidence-backed claim");
      assert.equal(proposals.filter((c) => c.kind === "PRICE_CHANGED" || c.kind === "SOURCE_NOT_FOUND" || c.kind === "NEW_PLAN").length, 0);
      assert.deepEqual(await verifiedState(), before, "no value changed");
      const pub = await db.product.findFirstOrThrow({ where: { status: "PUBLISHED", snapshots: { some: { status: "VERIFIED" } } }, select: { pricingCheckedAt: true, sourceCheckedAt: true } });
      assert.ok(pub.pricingCheckedAt && pub.pricingCheckedAt >= new Date(now.getTime() - 60_000), "pricing last-checked moves forward only after verbatim re-confirmation");
      const again = await run.startSync({ trigger: "SCHEDULED", now: new Date(now.getTime() + 3_600_000) });
      assert.equal(again.started, false);
      assert.match(again.reason ?? "", /Already synced/);
    });

    let priceChange = "";
    await t.test("product sync: changed price, blocked page, missing page and discovered links", async () => {
      await db.product.update({ where: { id: product.id }, data: { status: "PUBLISHED" } });
      const before = await verifiedState();
      mock.garbage = [{ junk: true }, "not-an-object", { requestUrl: "https://acme-sync.example/unknown", status: 200 }];
      mock.responder = acme({ pricing: ["Starter $15 per user/month, billed monthly.", "Pro $30 per user/month, billed monthly.", "Free plan available forever."], help: page("https://acme-sync.example/help", ["Access denied"], { status: 403 }), trust: null });
      const r = await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      mock.garbage = [];
      const done = await db.syncRun.findUniqueOrThrow({ where: { id: r.run!.id }, include: { pages: true } });
      assert.equal(done.status, "PARTIAL");
      assert.equal(done.phase, 2, "discovered links were validated in a second crawl");
      const byUrl = Object.fromEntries(done.pages.map((p) => [`${p.phase}:${p.url}`, p]));
      assert.equal(byUrl["1:https://acme-sync.example/help"].status, "BLOCKED");
      assert.equal(byUrl["1:https://acme-sync.example/trust"].status, "UNAVAILABLE");
      assert.match(byUrl["1:https://acme-sync.example/trust"].reason ?? "", /No result returned/);
      assert.equal((done.stats as Record<string, number>).validationFailures, 3, "malformed items are counted, not used");

      const changes = await db.dataChange.findMany({ where: { productId: product.id, status: "PENDING" } });
      const price = changes.find((c) => c.kind === "PRICE_CHANGED")!;
      assert.equal(price.targetId, old.id);
      assert.equal((price.payload as Record<string, unknown>).price, 15);
      assert.equal(price.evidence?.startsWith("Starter $15"), true);
      priceChange = price.id;
      const discovered = changes.filter((c) => c.kind === "NEW_SOURCE").map((c) => (c.payload as { url: string }).url).sort();
      assert.deepEqual(discovered, ["https://acme-sync.example/privacy"], "status-page did not return a result; off-domain link never proposed");
      assert.equal(changes.length, 2);

      // Nothing was overwritten or hidden: the $12 price, the blocked/missing pages' facts and sources stay verified.
      assert.deepEqual(await verifiedState(), before);
      const facts = await db.productFact.findMany({ where: { productId: product.id } });
      const f = (k: string) => facts.find((x) => x.key === k)!;
      assert.equal(f("support").checkedAt?.toISOString(), "2026-01-01T00:00:00.000Z", "blocked source keeps its last verified date");
      assert.equal(f("security").checkedAt?.toISOString(), "2026-01-01T00:00:00.000Z", "unavailable source keeps its last verified date");
      assert.ok(f("freePlan").checkedAt! > new Date("2026-01-02"), "re-confirmed fact date moves forward");
      const p = await db.product.findUniqueOrThrow({ where: { id: product.id } });
      assert.equal(p.pricingCheckedAt, null, "pricing last-checked does not move while a price is in doubt");
      assert.equal((await productSyncStates()).get(product.id)?.state, "review");
    });

    await t.test("repeat detection does not duplicate proposals; rejected proposals stay rejected", async () => {
      const privacy = await db.dataChange.findFirstOrThrow({ where: { productId: product.id, kind: "NEW_SOURCE" } });
      await review.rejectChange(privacy.id, { note: "Legal page, not needed" });
      await db.syncRun.updateMany({ where: { productId: product.id }, data: { startedAt: new Date(Date.now() - 3_600_000) } });
      mock.responder = acme({ pricing: ["Starter $15 per user/month, billed monthly.", "Pro $30 per user/month, billed monthly.", "Free plan available forever."], help: page("https://acme-sync.example/help", ["Access denied"], { status: 403 }), trust: null });
      await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      const all = await db.dataChange.findMany({ where: { productId: product.id } });
      assert.equal(all.filter((c) => c.kind === "PRICE_CHANGED").length, 1);
      assert.equal(all.filter((c) => c.kind === "NEW_SOURCE").length, 1);
      assert.equal(all.find((c) => c.kind === "NEW_SOURCE")!.status, "REJECTED");
      const pc = all.find((c) => c.kind === "PRICE_CHANGED")!;
      assert.ok(pc.lastSeenAt > pc.detectedAt, "seen again");
      await assert.rejects(run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id }), /30 minutes/);
    });

    await t.test("accepting a price publishes it through verification; revert restores the previous price", async () => {
      await review.acceptChange(priceChange, { by: "editor@test" });
      const snaps = await db.pricingSnapshot.findMany({ where: { productId: product.id, plan: "Starter" }, orderBy: { capturedAt: "asc" } });
      const fresh = snaps.find((s) => s.id !== old.id)!;
      assert.equal(fresh.status, "VERIFIED");
      assert.equal(Number(fresh.price), 15);
      assert.equal(fresh.sourceType, "AUTOMATED_DETECTION");
      assert.equal(fresh.evidence?.startsWith("Starter $15"), true);
      assert.equal(snaps.find((s) => s.id === old.id)!.status, "SUPERSEDED");
      assert.equal((await db.pricingSnapshot.findUniqueOrThrow({ where: { id: pro.id } })).status, "VERIFIED", "other plans untouched");
      const live = await db.pricingSnapshot.findMany({ where: { productId: product.id, status: "VERIFIED" }, orderBy: { plan: "asc" } });
      assert.deepEqual(live.map((x) => `${x.plan}:${Number(x.price)}`), ["Pro:30", "Starter:15"], "exactly one verified Starter price is public");
      await assert.rejects(review.acceptChange(priceChange), /already accepted/);

      await review.revertChange(priceChange);
      assert.equal((await db.pricingSnapshot.findUniqueOrThrow({ where: { id: old.id } })).status, "VERIFIED");
      assert.equal((await db.pricingSnapshot.findUniqueOrThrow({ where: { id: fresh.id } })).status, "SUPERSEDED");
      assert.equal((await db.dataChange.findUniqueOrThrow({ where: { id: priceChange } })).status, "REVERTED");
    });

    await t.test("a proposal resolves itself when the evidence returns; keep and accept for facts and sources", async () => {
      await db.syncRun.updateMany({ where: { productId: product.id }, data: { startedAt: new Date(Date.now() - 3_600_000) } });
      // Security page now 404s and the free-plan quote is gone.
      mock.responder = acme({ pricing: ["Starter $12 per user/month, billed monthly.", "Pro $30 per user/month, billed monthly."], trust: page("https://acme-sync.example/trust", ["Not found"], { status: 404 }) });
      await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      const pend = await db.dataChange.findMany({ where: { productId: product.id, status: "PENDING" } });
      const factGone = pend.find((c) => c.kind === "FACT_NOT_FOUND")!;
      const pageGone = pend.find((c) => c.kind === "SOURCE_NOT_FOUND")!;
      assert.ok(factGone && pageGone);

      await review.keepExisting(pageGone.id, { note: "Temporary outage" });
      assert.equal((await db.productSource.findUniqueOrThrow({ where: { id: src("SECURITY").id } })).status, "VERIFIED");

      await db.syncRun.updateMany({ where: { productId: product.id }, data: { startedAt: new Date(Date.now() - 3_600_000) } });
      mock.responder = acme();
      await run.startSync({ trigger: "MANUAL_PRODUCT", productId: product.id });
      await finishAll();
      const resolved = await db.dataChange.findUniqueOrThrow({ where: { id: factGone.id } });
      assert.equal(resolved.status, "KEPT");
      assert.match(resolved.note ?? "", /Resolved automatically/);
      assert.equal((await productSyncStates()).get(product.id)?.state, "verified");

      // Accepting a discovered link creates a verified official source; revert removes it again.
      const link = await db.dataChange.create({ data: { productId: product.id, kind: "NEW_SOURCE", field: "Source · STATUS", sourceUrl: "https://acme-sync.example/status", newValue: "Status", evidence: "Acme Status", payload: { kind: "STATUS", url: "https://acme-sync.example/status", name: "Acme Status" }, dedupeKey: "test-link" } });
      await review.acceptChange(link.id);
      const created = await db.productSource.findUniqueOrThrow({ where: { productId_url: { productId: product.id, url: "https://acme-sync.example/status" } } });
      assert.equal(created.status, "VERIFIED");
      await review.revertChange(link.id);
      assert.equal(await db.productSource.count({ where: { id: created.id } }), 0);

      // A guessed or off-domain link can never be accepted.
      const bad = await db.dataChange.create({ data: { productId: product.id, kind: "NEW_SOURCE", field: "Source · TERMS", sourceUrl: "https://elsewhere.example/terms", payload: { kind: "TERMS", url: "https://elsewhere.example/terms", name: "Terms" }, dedupeKey: "test-bad" } });
      await assert.rejects(review.acceptChange(bad.id), /not a valid official page/);
    });

    await db.product.delete({ where: { id: product.id } });
    await db.syncRun.deleteMany({});
    server.close();
  });
}
