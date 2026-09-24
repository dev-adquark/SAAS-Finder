import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const product = await db.product.findUnique({
    where: { id },
    include: { category: true, faqs: true, snapshots: true, links: true, changelog: true, refreshes: true },
  });
  return product ? NextResponse.json(product) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of ["slug","name","tagline","description","subcategory","rating","officialUrl","pricingUrl","bestFor","features","pros","cons","tags","comparison","status"]) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.category !== undefined) {
    const slug = String(body.category).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const category = await db.category.upsert({ where: { slug }, update: { name: String(body.category) }, create: { name: String(body.category), slug } });
    data.categoryId = category.id;
  }
  try {
    const product = await db.product.update({ where: { id }, data });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Product not found or update failed" }, { status: 404 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await db.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}
