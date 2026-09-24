import assert from "node:assert/strict";
import test from "node:test";
import { requireCronSecret } from "../lib/cron-auth";

test("accepts the configured cron bearer token", () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-secret";
  try {
    assert.equal(
      requireCronSecret(new Request("https://example.test", {
        headers: { authorization: "Bearer cron-secret" },
      })),
      true,
    );
    assert.equal(
      requireCronSecret(new Request("https://example.test", {
        headers: { authorization: "Bearer wrong" },
      })),
      false,
    );
    assert.equal(
      requireCronSecret(new Request("https://example.test")),
      false,
    );
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
