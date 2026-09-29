import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

/**
 * Removes copy-paste artefacts that can never be part of a valid connection string: surrounding
 * whitespace, a leading `DATABASE_URL=` (pasting an .env line into a dashboard), and wrapping quotes.
 */
export function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  let v = raw.trim().replace(/^DATABASE_URL\s*=\s*/, "").trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.at(-1) === v[0]) v = v.slice(1, -1).trim();
  return v;
}

/**
 * Configuration problems detectable from the URL's shape alone. Messages never include credentials.
 * Used to make a failed database read actionable in build and runtime logs.
 */
export function databaseUrlProblems(raw: string | undefined): string[] {
  const v = normalizeDatabaseUrl(raw);
  if (!v) return ["DATABASE_URL is not set."];
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return ["DATABASE_URL is not a valid URL (expected postgresql://USER:PASSWORD@HOST:PORT/DATABASE)."];
  }
  const out: string[] = [];
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") out.push(`DATABASE_URL must start with postgresql:// (found ${url.protocol}//).`);
  const direct = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (direct) out.push(`DATABASE_URL uses Supabase's direct host (db.${direct[1]}.supabase.co), which is IPv6-only and unreachable from Vercel. Use the transaction pooler: postgresql://postgres.${direct[1]}:PASSWORD@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true`);
  if (/\.pooler\.supabase\.com$/i.test(url.hostname)) {
    if (!decodeURIComponent(url.username).includes(".")) out.push("Supabase pooler connections need the username postgres.<project-ref> (e.g. postgres.abcd1234), not postgres.");
    if (url.port === "5432") out.push("DATABASE_URL uses the Supabase session pooler (port 5432), which allows few clients; use the transaction pooler on port 6543 for Vercel.");
  }
  return out;
}

/**
 * Caps the connection pool unless DATABASE_URL already sets `connection_limit`. `next build` runs
 * many static-generation workers in parallel, and serverless functions scale horizontally, so the
 * default pool size (cpus * 2 + 1 per process) can exhaust Postgres `max_connections`.
 */
export function pooledUrl(input: string | undefined, building = process.env.NEXT_PHASE === "phase-production-build"): string | undefined {
  const raw = normalizeDatabaseUrl(input);
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", building ? "2" : "5");
    // Supabase's transaction pooler (Supavisor, port 6543) multiplexes server connections per query,
    // so Prisma's named prepared statements collide ("42P05 prepared statement \"s0\" already exists").
    // `pgbouncer=true` makes Prisma skip them; it is required for this endpoint.
    if (/\.pooler\.supabase\.com$/i.test(url.hostname) && url.port === "6543" && !url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
    return url.toString();
  } catch {
    return raw;
  }
}

// Opt-in query audit (DEBUG_QUERY_LOG=1): logs every query's SQL and duration to stdout, prefixed
// so it can be isolated from other log lines. Zero-cost when unset; never enabled by default.
const withQueryEvents = new PrismaClient({ datasourceUrl: pooledUrl(process.env.DATABASE_URL), log: [{ emit: "event", level: "query" }] });
if (process.env.DEBUG_QUERY_LOG === "1") withQueryEvents.$on("query", (e) => console.log(`[qlog] ${e.duration}ms ${e.query.slice(0, 200)}`));
export const db = globalThis.prisma ?? withQueryEvents;
if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
