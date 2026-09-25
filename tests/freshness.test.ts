import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_REFRESH_AFTER_DAYS, formatDate, freshness, lastCheckedAt, needsRefresh, refreshTargetDays } from "../lib/freshness-rules";
import { formatPrice, lastCheckedText, pricingSummary, PRICING_FALLBACK } from "../lib/pricing";

const now = new Date("2026-09-25T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

test("refresh target defaults to 90 days with bounded manual override", () => {
  assert.equal(DEFAULT_REFRESH_AFTER_DAYS, 90);
  assert.equal(refreshTargetDays(null), 90);
  assert.equal(refreshTargetDays(30), 30);
  assert.equal(refreshTargetDays(0), 90);
  assert.equal(refreshTargetDays(99999), 90);
  assert.equal(refreshTargetDays(1.5), 90);
});

test("last checked is the latest of explicit check and verified snapshot", () => {
  assert.equal(lastCheckedAt(null, null), null);
  assert.equal(lastCheckedAt(daysAgo(10), daysAgo(40))?.getTime(), daysAgo(10).getTime());
  assert.equal(lastCheckedAt(daysAgo(40), daysAgo(10))?.getTime(), daysAgo(10).getTime());
});

test("freshness states", () => {
  assert.equal(freshness(null, 90, now).state, "never-checked");
  assert.equal(freshness(daysAgo(10), 90, now).state, "fresh");
  assert.equal(freshness(daysAgo(80), 90, now).state, "due-soon");
  assert.equal(freshness(daysAgo(91), 90, now).state, "overdue");
  assert.equal(needsRefresh(daysAgo(91), 90, now), true);
  assert.equal(needsRefresh(daysAgo(20), 30, now), false);
  assert.equal(needsRefresh(daysAgo(31), 30, now), true);
  assert.equal(needsRefresh(null, 90, now), true);
});

test("pricing display never invents prices", () => {
  assert.equal(PRICING_FALLBACK, "Pricing varies — check the official pricing page.");
  assert.equal(pricingSummary({ pricing: [] }), "Varies — see official pricing");
  assert.equal(lastCheckedText({ pricingLastChecked: null }), "Last checked: not yet verified by our editors");
  assert.equal(lastCheckedText({ pricingLastChecked: "2026-09-01T00:00:00.000Z" }), "Last checked: September 1, 2026");
  const pt = { plan: "Pro", price: 29, currency: "USD", billingPeriod: "MONTHLY" as const, note: "", sourceUrl: "https://x", sourceType: "OFFICIAL_PRICING_PAGE" as const, capturedAt: now.toISOString() };
  assert.equal(formatPrice(pt), "$29.00 per month");
  assert.equal(formatPrice({ ...pt, price: null }), "See vendor");
  assert.equal(formatPrice({ ...pt, billingPeriod: "FREE" }), "Free");
  assert.equal(formatDate("not a date"), null);
});
