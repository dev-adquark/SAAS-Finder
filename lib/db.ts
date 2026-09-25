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
    return url.toString();
  } catch {
    return raw;
  }
}

export const db = globalThis.prisma ?? new PrismaClient({ datasourceUrl: pooledUrl(process.env.DATABASE_URL) });
if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
