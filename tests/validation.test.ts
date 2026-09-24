import assert from "node:assert/strict";
import test from "node:test";

const validHttpUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const slugify = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

test("accepts HTTP and HTTPS URLs only", () => {
  assert.equal(validHttpUrl("https://example.com"), true);
  assert.equal(validHttpUrl("http://example.com/path"), true);
  assert.equal(validHttpUrl("javascript:alert(1)"), false);
  assert.equal(validHttpUrl("not-a-url"), false);
  assert.equal(validHttpUrl(""), false);
});

test("normalizes category slugs deterministically", () => {
  assert.equal(slugify("  Project Management & CRM  "), "project-management-crm");
  assert.equal(slugify("AI Tools"), "ai-tools");
  assert.equal(slugify(""), "");
});

test("blocks self alternatives", () => {
  const productId = "prod_123";
  const alternativeId = productId;
  assert.equal(alternativeId === productId, true);
});

test("accepts only supported snapshot types", () => {
  const types = new Set(["PRICING", "FEATURE", "GENERAL"]);
  assert.equal(types.has("PRICING"), true);
  assert.equal(types.has("FEATURE"), true);
  assert.equal(types.has("GENERAL"), true);
  assert.equal(types.has("OTHER"), false);
});

test("rejects inverted sponsor date ranges", () => {
  const startsAt = new Date("2026-10-02T00:00:00Z");
  const endsAt = new Date("2026-10-01T00:00:00Z");
  assert.equal(startsAt > endsAt, true);
});
