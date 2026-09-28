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

test("copy-paste artefacts are removed from DATABASE_URL", async () => {
  const { normalizeDatabaseUrl } = await import("../lib/db");
  const good = `${sb}:6543/postgres?pgbouncer=true`;
  for (const v of [`"${good}"`, `'${good}'`, `DATABASE_URL=${good}`, `DATABASE_URL="${good}"`, `  ${good}\n`]) assert.equal(normalizeDatabaseUrl(v), good);
  assert.equal(new URL(pooledUrl(`"${good}"`, false)!).hostname, "aws-0-ap-northeast-1.pooler.supabase.com");
});

test("configuration problems are named without exposing credentials", async () => {
  const { databaseUrlProblems } = await import("../lib/db");
  assert.deepEqual(databaseUrlProblems(`${sb}:6543/postgres?pgbouncer=true`), []);
  assert.deepEqual(databaseUrlProblems("postgresql://u:secretpw@ep-x-pooler.us-east-2.aws.neon.tech/db"), []);
  const direct = databaseUrlProblems("postgresql://postgres:secretpw@db.abcd1234.supabase.co:5432/postgres");
  assert.equal(direct.length, 1);
  assert.match(direct[0], /IPv6-only/);
  assert.match(direct[0], /postgres\.abcd1234:PASSWORD@<region>\.pooler\.supabase\.com:6543/);
  assert.match(databaseUrlProblems("postgresql://postgres:secretpw@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres").join(" "), /postgres\.<project-ref>/);
  assert.match(databaseUrlProblems(`${sb}:5432/postgres`).join(" "), /session pooler/);
  assert.match(databaseUrlProblems("mysql://u:p@h/db").join(" "), /must start with postgresql/);
  assert.deepEqual(databaseUrlProblems(undefined), ["DATABASE_URL is not set."]);
  for (const v of ["postgresql://postgres:secretpw@db.abcd1234.supabase.co:5432/postgres", "postgresql://postgres:secretpw@aws-0-x.pooler.supabase.com:6543/postgres", "not a url secretpw"]) {
    assert.ok(!databaseUrlProblems(v).join(" ").includes("secretpw"), "never echoes the password");
  }
});
