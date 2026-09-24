import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export async function GET(req: Request) { if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); return NextResponse.json(await db.category.findMany({ include: { _count: { select: { products: true } } }, orderBy: { name: "asc" } })); }
export async function POST(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const body = await req.json(); const name = String(body.name ?? "").trim(); const slug = slugify(String(body.slug ?? name)); if (!name || !slug) return NextResponse.json({ error: "valid name is required" }, { status: 400 });
    return NextResponse.json(await db.category.create({ data: { name, slug, description: body.description ?? null } }), { status: 201 });
  } catch { return NextResponse.json({ error: "Category already exists or payload is invalid" }, { status: 409 }); }
}