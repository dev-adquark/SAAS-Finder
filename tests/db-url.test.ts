import assert from "node:assert/strict";
import test from "node:test";
import { pooledUrl } from "../lib/db";

const sb = "postgresql://postgres.ref:pw@aws-0-ap-northeast-1.pooler.supabase.com";

test("Supabase transaction pooler always gets pgbouncer=true (prepared statements disabled)", () => {
  const u = new URL(pooledUrl(`${sb}:6543/postgres`, false)!);
  assert.equal(u.searchParams.get("pgbouncer"), "true");
  assert.equal(u.searchParams.get("connection_limit"), "5");
  assert.equal(new URL(pooledUrl(`${sb}:6543/postgres?pgbouncer=true&connection_limit=3`, true)!).searchParams.get("connection_limit"), "3", "explicit settings are kept");
});

test("other connection strings are not changed beyond the connection cap", () => {
  const session = new URL(pooledUrl(`${sb}:5432/postgres`, false)!);
  assert.equal(session.searchParams.has("pgbouncer"), false);
  const neon = new URL(pooledUrl("postgresql://u:p@ep-x-pooler.us-east-2.aws.neon.tech/db?sslmode=require&pgbouncer=true", true)!);
  assert.equal(neon.searchParams.get("pgbouncer"), "true");
  assert.equal(neon.searchParams.get("connection_limit"), "2");
  assert.equal(new URL(pooledUrl("postgresql://postgres:pw@localhost:5432/test", false)!).searchParams.has("pgbouncer"), false);
  assert.equal(pooledUrl(undefined), undefined);
});
