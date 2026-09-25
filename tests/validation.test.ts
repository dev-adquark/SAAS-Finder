import assert from "node:assert/strict";
import test from "node:test";
import { requireAdmin } from "../lib/admin-auth";
import { requireCronSecret } from "../lib/cron-auth";
import { boundedInt, isBoolean, isContentStatus, isHttpUrl, isNonEmptyString, isNonNegativeInteger, isRating, isSnapshotType, parseOptionalDate, slugify } from "../lib/validation";

test("accepts HTTP and HTTPS URLs only", () => {
  assert.equal(isHttpUrl("https://example.com"), true);
  assert.equal(isHttpUrl("http://example.com/path"), true);
  assert.equal(isHttpUrl("javascript:alert(1)"), false);
  assert.equal(isHttpUrl("not-a-url"), false);
});

test("normalizes category slugs deterministically", () => {
  assert.equal(slugify("Project Management"), "project-management");
  assert.equal(slugify("  CRM / Sales  "), "crm-sales");
  assert.equal(slugify(""), "");
});

test("accepts ratings from 0 through 5 only", () => {
  assert.equal(isRating(0), true);
  assert.equal(isRating(5), true);
  assert.equal(isRating(5.1), false);
  assert.equal(isRating("4.5"), false);
});

test("accepts supported content statuses only", () => {
  assert.equal(isContentStatus("PUBLISHED"), true);
  assert.equal(isContentStatus("draft"), false);
  assert.equal(isContentStatus("UNKNOWN"), false);
});

test("accepts only supported snapshot types", () => {
  assert.equal(isSnapshotType("PRICING"), true);
  assert.equal(isSnapshotType("FEATURE"), true);
  assert.equal(isSnapshotType("UNKNOWN"), false);
});

test("bounds common admin payload primitives", () => {
  assert.equal(isNonEmptyString("hello", 5), true);
  assert.equal(isNonEmptyString(" ", 5), false);
  assert.equal(isNonEmptyString("toolong", 5), false);
  assert.equal(isNonNegativeInteger(0), true);
  assert.equal(isNonNegativeInteger(2), true);
  assert.equal(isNonNegativeInteger(-1), false);
  assert.equal(isNonNegativeInteger(1.2), false);
  assert.equal(isBoolean(true), true);
  assert.equal(isBoolean("true"), false);
  assert.equal(parseOptionalDate("2026-09-24T00:00:00Z") instanceof Date, true);
  assert.equal(parseOptionalDate(null), null);
  assert.equal(parseOptionalDate("not-a-date"), undefined);
});

test("requires the configured admin bearer token", () => {
  const previous = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = "test-secret-0123456789";
  try {
    assert.equal(requireAdmin(new Request("https://example.test", { headers: { authorization: "Bearer test-secret-0123456789" } })), true);
    assert.equal(requireAdmin(new Request("https://example.test", { headers: { authorization: "Bearer wrong" } })), false);
    assert.equal(requireAdmin(new Request("https://example.test")), false);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = previous;
  }
});

test("requires the configured cron secret", () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-secret";
  try {
    assert.equal(requireCronSecret(new Request("https://example.test", { headers: { authorization: "Bearer cron-secret" } })), true);
    assert.equal(requireCronSecret(new Request("https://example.test", { headers: { "x-cron-secret": "cron-secret" } })), true);
    assert.equal(requireCronSecret(new Request("https://example.test", { headers: { authorization: "Bearer wrong" } })), false);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("boundedInt falls back when the parameter is missing (cron default batch size)", () => {
  assert.equal(boundedInt(null, 25, 1, 100), 25);
  assert.equal(boundedInt("", 25, 1, 100), 25);
  assert.equal(boundedInt("abc", 25, 1, 100), 25);
  assert.equal(boundedInt("0", 25, 1, 100), 1);
  assert.equal(boundedInt("500", 25, 1, 100), 100);
  assert.equal(boundedInt("7.9", 25, 1, 100), 7);
});
