import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await db.category.findMany({ include: { _count: { select: { products: true } } }, orderBy: { name: "asc" } }));
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const slug = body.slug ?? String(body.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const category = await db.category.create({ data: { name: String(body.name), slug, description: body.description ?? null } });
  return NextResponse.json(category, { status: 201 });
}
