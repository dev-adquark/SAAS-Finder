import assert from "node:assert/strict";
import test from "node:test";
import { requireAdmin } from "../lib/admin-auth";
import { isContentStatus, isHttpUrl, isSnapshotType, slugify } from "../lib/validation";

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

test("requires the configured admin bearer token", () => {
  const previous = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = "test-secret";
  try {
    assert.equal(requireAdmin(new Request("https://example.test", { headers: { authorization: "Bearer test-secret" } })), true);
    assert.equal(requireAdmin(new Request("https://example.test", { headers: { authorization: "Bearer wrong" } })), false);
    assert.equal(requireAdmin(new Request("https://example.test")), false);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = previous;
  }
});
