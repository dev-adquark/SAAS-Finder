import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { InputError } from "@/lib/admin/inputs";
import { NotFoundError } from "@/lib/admin/services";

export const MAX_ADMIN_BODY_BYTES = 64_000;

export async function readJson(req: Request): Promise<unknown> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_ADMIN_BODY_BYTES) throw new InputError(["request body too large"]);
  const raw = await req.text();
  if (raw.length > MAX_ADMIN_BODY_BYTES) throw new InputError(["request body too large"]);
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new InputError(["body must be valid JSON"]);
  }
}

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps an admin API handler: bearer auth, database check, and safe error mapping. Internal error
 * details are never returned to the caller.
 */
export function adminRoute<P = Record<string, never>>(handler: (req: Request, params: P) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      const result = await handler(req, params);
      const status = req.method === "POST" ? 201 : 200;
      return NextResponse.json(result ?? { ok: true }, { status });
    } catch (error) {
      if (error instanceof InputError) return NextResponse.json({ error: "Invalid request", problems: error.problems }, { status: 400 });
      if (error instanceof NotFoundError) return NextResponse.json({ error: error.message || "Not found" }, { status: 404 });
      console.error("[admin-api]", req.method, new URL(req.url).pathname, error instanceof Error ? error.name : "error");
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }
  };
}
