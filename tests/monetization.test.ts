import assert from "node:assert/strict";
import test from "node:test";
import { resolveOutbound } from "../lib/outbound";
import { isRenderableSponsor, pickSponsor, sponsorDisplayLabel, type SponsorRecord } from "../lib/sponsors";
import { campaignFromSearchParams, campaignQuery, parseAnalyticsPayload, MAX_BODY_BYTES } from "../lib/analytics";

test("outbound uses only stored, verified https affiliate URLs", () => {
  assert.deepEqual(resolveOutbound({ affiliate: { url: "https://partner.example/ref?id=1", label: "x", provider: null }, officialUrl: "https://vendor.example" }), { url: "https://partner.example/ref?id=1", kind: "affiliate" });
  const insecure = resolveOutbound({ affiliate: { url: "http://partner.example/ref", label: "x", provider: null }, officialUrl: "https://vendor.example/" });
  assert.equal(insecure?.kind, "official");
  assert.ok(insecure?.url.startsWith("https://vendor.example/?utm_source=saasfinder"));
  assert.equal(resolveOutbound({ affiliate: { url: "javascript:alert(1)", label: "x", provider: null }, officialUrl: "https://vendor.example" })?.kind, "official");
  assert.equal(resolveOutbound({ affiliate: null, officialUrl: "javascript:alert(1)" }), null);
});

test("affiliate URLs are not modified with UTM tags", () => {
  assert.equal(resolveOutbound({ affiliate: { url: "https://p.example/?a=1", label: "x", provider: null }, officialUrl: "https://v.example" })?.url, "https://p.example/?a=1");
});

const base: SponsorRecord = { id: "s1", title: "Acme", label: "Sponsored", description: null, pageType: "product", placement: "sidebar", priority: 0, active: true, url: "https://acme.example", startsAt: null, endsAt: null };
const now = new Date("2026-09-25T12:00:00Z");

test("sponsor rendering rules", () => {
  assert.equal(isRenderableSponsor(base, now), true);
  assert.equal(isRenderableSponsor({ ...base, active: false }, now), false, "inactive");
  assert.equal(isRenderableSponsor({ ...base, endsAt: new Date("2026-09-24") }, now), false, "expired");
  assert.equal(isRenderableSponsor({ ...base, startsAt: new Date("2026-10-01") }, now), false, "not started");
  assert.equal(isRenderableSponsor({ ...base, url: null }, now), false, "no url");
  assert.equal(isRenderableSponsor({ ...base, url: "javascript:x" }, now), false, "bad url");
  assert.equal(isRenderableSponsor({ ...base, title: " " }, now), false, "no title");
  assert.equal(isRenderableSponsor({ ...base, label: "" }, now), false, "no label");
  assert.equal(isRenderableSponsor({ ...base, pageType: "home" }, now), false, "disallowed page type");
  assert.equal(isRenderableSponsor({ ...base, placement: "inline", priority: 5 }, now), false, "below inline threshold");
  assert.equal(isRenderableSponsor({ ...base, placement: "inline", priority: 10 }, now), true);
});

test("pickSponsor chooses highest priority renderable slot for the placement", () => {
  const slots = [{ ...base, id: "a", priority: 1 }, { ...base, id: "b", priority: 5 }, { ...base, id: "c", priority: 9, active: false }, { ...base, id: "d", priority: 50, pageType: "compare" }];
  assert.equal(pickSponsor(slots, "product", "sidebar", now)?.id, "b");
  assert.equal(pickSponsor(slots, "best", "sidebar", now), null);
});

test("sponsor label always says Sponsored", () => {
  assert.equal(sponsorDisplayLabel("Sponsored"), "Sponsored");
  assert.equal(sponsorDisplayLabel("Partner"), "Sponsored · Partner");
  assert.equal(sponsorDisplayLabel(""), "Sponsored");
});

test("campaign metadata is whitelisted", () => {
  const c = campaignFromSearchParams(new URLSearchParams("pt=product&ps=wix&ct=hero&pl=hero&evil=1"), "wix");
  assert.deepEqual(c, { product: "wix", pageType: "product", pageSlug: "wix", ctaType: "hero", placement: "hero" });
  const bad = campaignFromSearchParams(new URLSearchParams("pt=nope&ps=<script>&ct=popup&pl=a b"), "wix");
  assert.deepEqual(bad, { product: "wix", pageType: null, pageSlug: null, ctaType: null, placement: null });
  assert.equal(campaignQuery({ pageType: "best", pageSlug: "crm-for-freelancers", ctaType: "plan", placement: "pick-1" }), "?pt=best&ps=crm-for-freelancers&ct=plan&pl=pick-1");
});

test("analytics payload validation", () => {
  assert.equal(parseAnalyticsPayload("{bad").ok, false);
  const invalidEvent = parseAnalyticsPayload(JSON.stringify({ event: "purchase" }));
  assert.equal(invalidEvent.ok === false && invalidEvent.status, 400);
  const tooBig = parseAnalyticsPayload("x".repeat(MAX_BODY_BYTES + 1));
  assert.equal(tooBig.ok === false && tooBig.status, 413);
  const ok = parseAnalyticsPayload(JSON.stringify({ event: "cta_click", path: "/wix?utm=1", product: "wix", pageType: "product", pageSlug: "wix", ctaType: "hero", placement: "hero", data: { email: "a@b.c", variant: "a", nested: { x: 1 } } }));
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.record.path, "/wix");
    assert.equal(ok.record.productSlug, "wix");
    assert.equal(ok.record.ctaType, "hero");
    assert.deepEqual(ok.record.metadata, { variant: "a" }, "sensitive and nested metadata dropped");
  }
  for (const event of ["page_view", "outbound_click", "cta_click", "sponsor_click", "cpl_submit"]) assert.equal(parseAnalyticsPayload(JSON.stringify({ event })).ok, true, event);
});
