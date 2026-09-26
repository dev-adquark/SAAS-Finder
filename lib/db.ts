import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

/**
 * Caps the connection pool unless DATABASE_URL already sets `connection_limit`. `next build` runs
 * many static-generation workers in parallel, and serverless functions scale horizontally, so the
 * default pool size (cpus * 2 + 1 per process) can exhaust Postgres `max_connections`.
 */
export function pooledUrl(raw: string | undefined, building = process.env.NEXT_PHASE === "phase-production-build"): string | undefined {
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

export const db = globalThis.prisma ?? new PrismaClient({ datasourceUrl: pooledUrl(process.env.DATABASE_URL) });
if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
